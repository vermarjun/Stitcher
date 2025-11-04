import traceback
import multiprocessing as mp
from multiprocessing import Queue as MPQueue
import time
from typing import Any, Dict, Optional
from core.GenerateVideo.render_and_upload import render_and_upload_manim
from core.GenerateVideo.debugger_agent import debugger_agent_wrapper
from core.GenerateVideo.Generate_new.chat_updater import ChatUpdater

# Timeout (seconds) for rendering a scene
RENDER_TIMEOUT_SECONDS = 200
MAX_DEBUG_ATTEMPTS = 3

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

def _safe_update_scene_render(chat_id, scene_name, code, scene_description, project_id, metadata):
    """
    Calls ChatUpdater.update_scene_render async function safely from sync code.
    """
    if ChatUpdater is None:
        # best-effort fallback: just log
        print("ChatUpdater not available; skipping update_scene_render.")
        return
    try:
        return _call_async(
            ChatUpdater.update_scene_render,
            code=code,
            chat_id=chat_id,
            scene_name=scene_name,
            scene_description=scene_description,
            project_id=project_id,
            metadata=metadata
        )
    except Exception as e:
        print("Failed to call update_scene_render:", e)
        raise

def _safe_update_scene_code(chat_id, scene_name, new_code):
    if ChatUpdater is None:
        print("ChatUpdater not available; skipping update_scene_code.")
        return
    try:
        return _call_async(
            ChatUpdater.update_scene_code,
            chat_id=chat_id,
            scene_name=scene_name,
            new_code=new_code
        )
    except Exception as e:
        print("Failed to call update_scene_code:", e)
        raise

def _safe_update_scene_error(chat_id, scene_name, error):
    if ChatUpdater is None:
        print("ChatUpdater not available; skipping update_scene_error.")
        return
    try:
        return _call_async(
            ChatUpdater.update_scene_error,
            chat_id=chat_id,
            scene_name=scene_name,
            error=error
        )
    except Exception as e:
        print("Failed to call update_scene_error:", e)
        raise

def _safe_debugger_call(original_code: str, error_msg: str) -> str:
    """
    Calls your async debugger_agent_wrapper and returns the fixed code string.
    """
    try:
        fixed = _call_async(debugger_agent_wrapper, original_code, error_msg)
        return fixed
    except Exception as e:
        print("Debugger call failed:", e)
        raise

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

    if code is None:
        err = "No code provided for scene"
        print(err)
        if ChatUpdater:
            try:
                _safe_update_scene_error(chat_id=chat_id, scene_name=scene_name, error=err)
            except Exception:
                pass
        return {"success": False, "error": err}

    attempts = 0
    last_error = None

    while attempts < MAX_DEBUG_ATTEMPTS:
        attempts += 1
        print(f"[Worker] Rendering scene '{scene_name}' (attempt {attempts}/{MAX_DEBUG_ATTEMPTS})")
        try:
            # Run the render/upload function inside a subprocess with timeout
            proc_res = run_func_in_process(
                render_and_upload_manim,
                args=(code, scene_name),
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
                            _safe_update_scene_render(
                                chat_id=chat_id,
                                scene_name=scene_name,
                                code=code,
                                scene_description=description,
                                project_id=project_id,
                                metadata=metadata
                            )
                        except Exception as e:
                            print("[Worker] Warning: failed to update DB after success:", e)
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
                        _safe_update_scene_code(chat_id=chat_id, scene_name=scene_name, new_code=fixed_code)
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
            # Final failure after MAX_DEBUG_ATTEMPTS
            print(f"[Worker] Final failure for scene '{scene_name}'. Error: {last_error}")
            try:
                _safe_update_scene_error(chat_id=chat_id, scene_name=scene_name, error=last_error)
            except Exception as e:
                print("[Worker] Warning: failed to write final error to DB:", e)
            return {
                "success": False,
                "sceneName": scene_name,
                "metadata": None,
                "error": last_error
            }

    # Shouldn't normally reach here
    return {
        "success": False,
        "sceneName": scene_name,
        "metadata": None,
        "error": last_error or "Unknown"
    }