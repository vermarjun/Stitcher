import traceback
import multiprocessing as mp
from multiprocessing import Queue as MPQueue
import time
from typing import Any, Dict, Optional

from app.core.GenerateVideo.render_and_upload import render_and_upload_manim
from app.core.GenerateVideo.debugger_agent import debugger_agent_wrapper
from app.utils.initialize_redis import initializeRedis

import ast

# Timeout (seconds) for rendering a scene
RENDER_TIMEOUT_SECONDS = 200
MAX_DEBUG_ATTEMPTS = 3

# Initialize redis for this worker process (so functions that call get_redis_manager() work)
try:
    initializeRedis()
    print("[Worker] initializeRedis() called in main worker process.")
except Exception as e:
    print(f"[Worker] Warning: initializeRedis() failed at startup: {e}")

def _proc_target(func, args, out_q: MPQueue):
    """
    Target wrapper to run a function and put its result into an MP Queue.
    This runs inside a child process (so that it can be force-terminated on timeout).
    """
    try:
        result = func(*args)
        out_q.put({"ok": True, "result": result})
    except Exception as e:
        out_q.put({"ok": False, "exc": traceback.format_exc()})

def run_func_in_process(func, args=(), timeout: int = 200) -> Dict[str, Any]:
    """
    Runs func(*args) in a subprocess and returns its result dict.
    Returns:
      - {"timed_out": True} if timed out
      - {"ok": True, "result": ...} on success
      - {"ok": False, "exc": "<traceback>"} on exception inside child
    """
    out_q = mp.Queue()
    p = mp.Process(target=_proc_target, args=(func, args, out_q))
    p.start()
    p.join(timeout)
    if p.is_alive():
        try:
            p.terminate()
        except Exception:
            pass
        p.join(1)
        # Clear queue if anything pending
        while not out_q.empty():
            try:
                out_q.get_nowait()
            except Exception:
                break
        return {"timed_out": True}
    else:
        # get result if available
        try:
            res = out_q.get_nowait()
            return res
        except Exception as e:
            return {"ok": False, "exc": f"Child finished but no result: {str(e)}"}

def _call_async(coro_fn, *args, **kwargs):
    """
    Run an async function from sync context. Uses asyncio.run.
    """
    import asyncio
    return asyncio.run(coro_fn(*args, **kwargs))

def _get_chat_updater_class(is_edited: bool):
    """
    Lazy-import the appropriate ChatUpdater class and return the class object.
    Returns None if import fails.
    """
    try:
        if is_edited:
            # edited-video updater
            mod = __import__('app.core.GenerateVideo.edit.chat_updater', fromlist=['ChatUpdater'])
            return getattr(mod, 'ChatUpdater', None)
        else:
            # new-video updater
            mod = __import__('app.core.GenerateVideo.Generate_new.chat_updater', fromlist=['ChatUpdater'])
            return getattr(mod, 'ChatUpdater', None)
    except Exception as e:
        print(f"[Worker] Failed to import ChatUpdater (is_edited={is_edited}): {e}")
        return None
    
def _call_updater_method(is_edited: bool, method_name: str, *args, **kwargs):
    """
    Centralized way to call async updater methods from sync code.
    - Lazy-imports the appropriate ChatUpdater class.
    - Calls the method if it exists; logs and returns if not.
    """
    updater_cls = _get_chat_updater_class(is_edited)
    if updater_cls is None:
        print(f"[Worker] ChatUpdater class not available for is_edited={is_edited}; skipping {method_name}.")
        return None

    method = getattr(updater_cls, method_name, None)
    if method is None:
        # Some updaters may have different method names; handle gracefully.
        print(f"[Worker] Updater for is_edited={is_edited} missing method {method_name}; skipping.")
        return None

    try:
        return _call_async(method, *args, **kwargs)
    except Exception as e:
        print(f"[Worker] Exception while calling updater.{method_name}: {e}")
        raise

def _safe_update_scene_render(is_edited: bool, chat_id, scene_name, code, scene_description, project_id, metadata):
    return _call_updater_method(
        is_edited=is_edited,
        method_name='update_scene_render',
        code=code,
        chat_id=chat_id,
        scene_name=scene_name,
        scene_description=scene_description,
        project_id=project_id,
        metadata=metadata
    )

def _safe_debugger_call(original_code: str, error_msg: str) -> Optional[str]:
    """
    Call debugger_agent_wrapper (async) from sync code and return fixed code string.
    Returns None on failure.
    """
    try:
        fixed = _call_async(debugger_agent_wrapper, original_code, error_msg)
        return fixed
    except Exception as e:
        print(f"[Worker] Debugger call failed: {e}")
        return None


def _safe_update_scene_code(is_edited: bool, chat_id, scene_name, new_code, scene_description: Optional[str] = ""):
    # note: edit-updater might expect scene_description when updating code
    kwargs = {'chat_id': chat_id, 'scene_name': scene_name, 'new_code': new_code, 'scene_description': scene_description}
    return _call_updater_method(is_edited=is_edited, method_name='update_scene_code', **kwargs)

def _safe_update_scene_error(is_edited: bool, chat_id, scene_name, error):
    return _call_updater_method(is_edited=is_edited, method_name='update_scene_error', chat_id=chat_id, scene_name=scene_name, error=error)

def _safe_update_final_response(is_edited: bool, chat_id, llm_response):
    return _call_updater_method(
        is_edited=is_edited,
        method_name='update_final_response',
        chat_id=chat_id,
        llm_response=llm_response
    )

def validate_manim_code(code: str) -> Optional[str]:
    """
    Three-layer validation for Manim code.
    Returns None if valid, or error message string if invalid.
    """
    # --- 1. Syntax check ---
    try:
        ast.parse(code)
    except SyntaxError as e:
        return f"SyntaxError: {e}"

    # --- 2. Import + exec check ---
    namespace = {}
    try:
        import manim
        # local import to avoid module import at top-level before runtime
        exec(code, namespace)
    except Exception as e:
        return f"RuntimeError: {type(e).__name__}: {e}"

    # --- 3. Scene instantiation check ---
    try:
        import manim
        Scene = manim.Scene
        for obj in namespace.values():
            if isinstance(obj, type) and issubclass(obj, Scene):
                scene = obj()
                # call construct() to surface potential runtime errors early
                scene.construct()
                return None
        return "SceneDefinitionError: No valid Scene subclass found"
    except Exception as e:
        return f"SceneError: {type(e).__name__}: {e}"

def render_scene(job_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    RQ job entrypoint: `worker.render_scene`
    Expects job_data dict with keys: sceneName, code, description, projectId, userId, chatId, sceneIndex
    """
    # Basic validation and extraction
    scene_name = job_data.get("sceneName") or job_data.get("scene_name") or "Scene"
    code = job_data.get("code")
    description = job_data.get("description", "")
    project_id = job_data.get("projectId") or job_data.get("project_id")
    user_id = job_data.get("userId") or job_data.get("user_id")
    chat_id = job_data.get("chatId") or job_data.get("chat_id")
    scene_index = job_data.get("sceneIndex")
    is_edited = bool(job_data.get("is_edited", False))
    public_id = user_id

    if code is None:
        err = "No code provided for scene"
        print(err)
        try:
            _safe_update_scene_error(is_edited=is_edited, chat_id=chat_id, scene_name=scene_name, error=err)
        except Exception:
            pass
        return {"success": False, "error": err}

    # -------------------------
    # PRE-RENDER: run AST/security/scene checks and attempt to fix via debugger BEFORE rendering
    # -------------------------
    validation_error = None
    try:
        validation_error = validate_manim_code(code)
    except Exception as e:
        validation_error = f"Validation exception: {e}"

    if validation_error is not None:
        print(f"[Worker] Initial validation failed for '{scene_name}': {validation_error}")
        pre_attempt = 0
        while pre_attempt < MAX_DEBUG_ATTEMPTS:
            pre_attempt += 1
            print(f"[Worker] Pre-render debugger attempt {pre_attempt}/{MAX_DEBUG_ATTEMPTS} for '{scene_name}'")
            try:
                fixed_code = _safe_debugger_call(code, validation_error or "Validation failed")
                if not fixed_code or not isinstance(fixed_code, str):
                    print("[Worker] Debugger returned invalid output during pre-render; will continue attempts.")
                else:
                    # Update DB with new code (chat updater)
                    try:
                        print("[Worker] Debugger returned fixed code during pre-render; updating DB with new code.")
                        _safe_update_scene_code(
                            is_edited=is_edited,
                            chat_id=chat_id,
                            scene_name=scene_name,
                            new_code=fixed_code,
                            scene_description=description
                        )
                    except Exception as e:
                        print("[Worker] Warning: failed to update DB with debugged code (pre-render):", e)
                    # Replace code and re-validate
                    code = fixed_code
                    try:
                        validation_error = validate_manim_code(code)
                    except Exception as e:
                        validation_error = f"Validation exception after debugger: {e}"
                    if validation_error is None:
                        print(f"[Worker] Validation passed after pre-render debugger for '{scene_name}'. Proceeding to render.")
                        break
                    else:
                        print(f"[Worker] Validation still failing after debugger attempt {pre_attempt}: {validation_error}")
                time.sleep(0.3)
                continue
            except Exception as e:
                print("[Worker] Exception while calling debugger in pre-render phase:", e)
                time.sleep(0.2) #Prevent rapid-fire retries (debounce)
                continue

        # If we've exhausted pre-render attempts and still invalid => bail out without rendering
        if validation_error is not None:
            final_err = f"Failed validation after {MAX_DEBUG_ATTEMPTS} attempts: {validation_error}"
            print(f"[Worker] Pre-render validation final failure for '{scene_name}': {final_err}")
            try:
                _safe_update_scene_error(is_edited=is_edited, chat_id=chat_id, scene_name=scene_name, error=final_err)
            except Exception as e:
                print("[Worker] Warning: failed to write final validation error to DB:", e)
            return {"success": False, "sceneName": scene_name, "metadata": None, "error": final_err}

    # -------------------------
    # RENDER LOOP: attempt render, on failure call debugger and retry
    # -------------------------
    attempts = 0
    last_error = None

    while attempts < MAX_DEBUG_ATTEMPTS:
        attempts += 1
        print(f"[Worker] Rendering scene '{scene_name}' (attempt {attempts}/{MAX_DEBUG_ATTEMPTS})")
        try:
            # Run the render/upload function inside a subprocess with timeout
            proc_res = run_func_in_process(
                render_and_upload_manim,
                args=(code, scene_name, 15, 'l', public_id),
                timeout=RENDER_TIMEOUT_SECONDS
            )

            if proc_res.get("timed_out"):
                last_error = f"Render timed out after {RENDER_TIMEOUT_SECONDS} seconds"
                print(f"[Worker] {last_error}")
            elif not proc_res.get("ok", False):
                last_error = f"Render process failed: {proc_res.get('exc')}"
                print(f"[Worker] {last_error}")
            else:
                result = proc_res.get("result")
                # result expected to be a dict {success: bool, metadata:..., error:...}
                if not isinstance(result, dict):
                    last_error = f"Invalid render result type: {type(result)}"
                    print(f"[Worker] {last_error}")
                else:
                    if result.get("success"):
                        metadata = result.get("metadata")
                        print(f"[Worker] Render succeeded for '{scene_name}': {metadata}")
                        # Update MongoDB with successful render metadata
                        try:
                            ok = _safe_update_scene_render(
                                is_edited=is_edited,
                                chat_id=chat_id,
                                scene_name=scene_name,
                                code=code,
                                scene_description=description,
                                project_id=project_id,
                                metadata=metadata
                            )
                            print(f"[Worker] update_scene_render returned: {ok}")
                            if not ok:
                                print(f"[Worker] ERROR: update_scene_render returned False for scene '{scene_name}' (asset created at {metadata})")
                        except Exception as e:
                            print("[Worker] Warning: failed to update DB after success (exception):", e)
                            traceback.print_exc()
                        return {
                            "success": True,
                            "sceneName": scene_name,
                            "metadata": metadata,
                            "error": None
                        }
                    else:
                        # Render returned an error message
                        last_error = result.get("error") or "Unknown render error"
                        print(f"[Worker] Render function returned failure: {last_error}")

        except Exception as exc:
            # Catch-all to protect worker from unexpected issues
            last_error = f"Unexpected worker error: {traceback.format_exc()}"
            print("[Worker] Unexpected error during render attempt:", last_error)

        # If we reach here, the render failed or timed out
        if attempts < MAX_DEBUG_ATTEMPTS:
            # Call debugger to fix code, update code in DB, and retry
            try:
                print(f"[Worker] Calling debugger for scene '{scene_name}' (attempt {attempts})")
                fixed_code = _safe_debugger_call(code, last_error or "Unknown error")
                if not fixed_code or not isinstance(fixed_code, str):
                    print("[Worker] Debugger returned invalid output; will treat as failure.")
                    # proceed to next attempt (this one consumed)
                else:
                    # Write new code for next attempt
                    print("[Worker] Debugger returned fixed code; updating DB with new code.")
                    try:
                        _safe_update_scene_code(
                            is_edited=is_edited,
                            chat_id=chat_id, 
                            scene_name=scene_name, 
                            new_code=fixed_code,
                            scene_description=description 
                        )
                    except Exception as e:
                        print("[Worker] Warning: failed to update DB with debugged code:", e)
                    code = fixed_code
                    # loop will retry
                    time.sleep(0.5)  # small backoff before retrying
                    continue
            except Exception as e:
                print("[Worker] Debugger call failed with exception:", e)
                # continue to next attempt (attempt consumed)
                time.sleep(0.2)
                continue
        else:
            print(f"[Worker] Final failure for scene '{scene_name}'. Error: {last_error}")
            try:
                _safe_update_scene_error(is_edited=is_edited, chat_id=chat_id, scene_name=scene_name, error=last_error)
            except Exception as e:
                print("[Worker] Warning: failed to write final error to DB:", e)
            return {"success": False, "sceneName": scene_name, "metadata": None, "error": last_error}

    return {"success": False, "sceneName": scene_name, "metadata": None, "error": last_error or "Unknown"}