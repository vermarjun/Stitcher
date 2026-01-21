import redis
import asyncio
import uuid
import time
from app.config.environment import REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, INITIAL_CONFIGS
from app.utils.redis_manager import APIKeyHeapManager
from app.utils.sequenceQueue_manager import SceneQueueManager

# Global heap manager instances
coder_heap_manager: APIKeyHeapManager | None = None
planner_heap_manager: APIKeyHeapManager | None = None
summarizer_heap_manager: APIKeyHeapManager | None = None
scene_queue_manager: SceneQueueManager | None = None

def initializeRedis():
    global coder_heap_manager, planner_heap_manager, summarizer_heap_manager, scene_queue_manager

    r = redis.Redis(host=REDIS_HOST or "",port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=False)

    # Separate configs by heap type
    coder_configs = [c for c in INITIAL_CONFIGS if c.get('heap_type') == 'coder']
    planner_configs = [c for c in INITIAL_CONFIGS if c.get('heap_type') == 'planner']
    summarizer_configs = [c for c in INITIAL_CONFIGS if c.get('heap_type') == 'summarizer']
    
    print(f"\n{'='*60}")
    print("Initializing API Key Heaps")
    print(f"{'='*60}")
    print(f"Coder configs: {len(coder_configs)}")
    print(f"Planner configs: {len(planner_configs)}")
    print(f"Summarizer configs: {len(summarizer_configs)}")
    print(f"{'='*60}\n")

    # Initialize 3 separate heaps with different Redis keys
    coder_heap_manager = APIKeyHeapManager(r, heap_key="coder_api_keys_heap")
    coder_heap_manager.initialize_heap(coder_configs)
    print(f"✓ Coder heap initialized with {len(coder_configs)} API keys")

    planner_heap_manager = APIKeyHeapManager(r, heap_key="planner_api_keys_heap")
    planner_heap_manager.initialize_heap(planner_configs)
    print(f"✓ Planner heap initialized with {len(planner_configs)} API keys")

    summarizer_heap_manager = APIKeyHeapManager(r, heap_key="summarizer_api_keys_heap")
    summarizer_heap_manager.initialize_heap(summarizer_configs)
    print(f"✓ Summarizer heap initialized with {len(summarizer_configs)} API keys")

    # Initialize scene queue manager
    scene_queue_manager = SceneQueueManager(r)
    
    print("\n✓ REDIS and RQ successfully initialized with 3 separate heaps!\n")
    return coder_heap_manager, planner_heap_manager, summarizer_heap_manager, scene_queue_manager

def get_redis_manager() -> APIKeyHeapManager:
    """
    DEPRECATED: Use get_coder_heap_manager(), get_planner_heap_manager(), 
    or get_summarizer_heap_manager() instead.
    
    For backward compatibility, returns coder heap.
    """
    print("[WARNING] get_redis_manager() is deprecated. Use specific heap managers instead.")
    return get_coder_heap_manager()

def get_coder_heap_manager() -> APIKeyHeapManager:
    """Get the coder heap manager (big models for code generation)"""
    if coder_heap_manager is None:
        raise RuntimeError("Coder heap not initialized. Call initializeRedis() first.")
    return coder_heap_manager

def get_planner_heap_manager() -> APIKeyHeapManager:
    """Get the planner heap manager (medium models for scene planning)"""
    if planner_heap_manager is None:
        raise RuntimeError("Planner heap not initialized. Call initializeRedis() first.")
    return planner_heap_manager

def get_summarizer_heap_manager() -> APIKeyHeapManager:
    """Get the summarizer heap manager (small models for summarization)"""
    if summarizer_heap_manager is None:
        raise RuntimeError("Summarizer heap not initialized. Call initializeRedis() first.")
    return summarizer_heap_manager

def get_scene_queue_manager() -> SceneQueueManager:
    """Get the global scene queue manager instance"""
    if scene_queue_manager is None:
        raise RuntimeError("Scene queue manager not initialized. Call initializeRedis() first.")
    return scene_queue_manager

async def fetch_api_key_with_queue(
    heap_manager: APIKeyHeapManager,
    timeout: int = 300  # 5 minutes default timeout
) -> dict:
    """
    Queue-based API key fetching. Waits in category-specific queue if no keys available.
    Uses Redis pub/sub for event-driven assignment (no polling).
    
    Args:
        heap_manager: The heap manager for this category (coder/planner/summarizer)
        timeout: Maximum time to wait in seconds (default: 300s = 5min)
    
    Returns:
        API config dict with keys: email, api_key, model, base_url, tokens_used
    
    Raises:
        TimeoutError: If no API key becomes available within timeout period
    """
    # First, try to get immediately
    api_config = heap_manager.get_least_used_api_key()
    if api_config:
        return api_config
    
    # No keys available - join the queue
    request_id = str(uuid.uuid4())
    heap_name = heap_manager.heap_key.replace("_api_keys_heap", "")
    print(f"[Queue] No API keys available in {heap_name} heap. Joining queue as {request_id[:8]}...")
    
    # Add to queue
    heap_manager.add_to_queue(request_id)
    queue_pos = heap_manager.get_queue_size()
    print(f"[Queue] Position in {heap_name} queue: {queue_pos}")
    
    # Create pubsub connection for this heap's channel
    pubsub = heap_manager.redis.pubsub()
    pubsub.subscribe(heap_manager.notify_channel)
    
    start_time = time.time()
    
    try:
        # Consume the subscription confirmation message
        while True:
            message = pubsub.get_message(timeout=0.1)
            if message and message['type'] == 'subscribe':
                break
            if time.time() - start_time > 2:  # Don't wait forever for subscription
                break
        
        # Wait for notification with timeout
        while True:
            # Check timeout
            elapsed = time.time() - start_time
            if elapsed > timeout:
                raise TimeoutError(
                    f"Waited {timeout}s in {heap_name} queue, no API key became available. "
                    f"Queue had {queue_pos} request(s) ahead."
                )
            
            # Wait for message (blocking with 1s timeout)
            message = pubsub.get_message(timeout=1.0)
            
            if message and message['type'] == 'message':
                # Notification received! Try to get key
                api_config = heap_manager.get_least_used_api_key()
                if api_config:
                    elapsed_time = time.time() - start_time
                    print(f"[Queue] ✓ {request_id[:8]} acquired {heap_name} API key after {elapsed_time:.1f}s")
                    return api_config
                # If we didn't get it, another agent was faster - continue waiting
                print(f"[Queue] {request_id[:8]} missed the key (another agent got it first), continuing to wait...")
            
            # Brief async sleep to allow other coroutines to run
            await asyncio.sleep(0.1)
    
    finally:
        # Always cleanup: remove from queue and close pubsub
        heap_manager.remove_from_queue(request_id)
        pubsub.unsubscribe()
        pubsub.close()


# Deprecated - keeping for backward compatibility
async def fetch_api_key_with_wait(redis_manager, retry_delay=1, max_wait=60):
    """
    DEPRECATED:Use fetch_api_key_with_queue instead.
    This function uses polling which is less efficient.
    """
    print("[WARNING] fetch_api_key_with_wait is deprecated. Use fetch_api_key_with_queue instead.")
    return await fetch_api_key_with_queue(redis_manager, timeout=max_wait)