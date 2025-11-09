import redis
import asyncio
from app.config.environment import REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, INITIAL_CONFIGS
from app.utils.redis_manager import APIKeyHeapManager
from app.utils.sequenceQueue_manager import SceneQueueManager

# Global redis manager instance
redis_manager: APIKeyHeapManager | None = None
scene_queue_manager: SceneQueueManager | None = None

def initializeRedis():
    global redis_manager, scene_queue_manager

    r = redis.Redis(host=REDIS_HOST or "",port=REDIS_PORT, password=REDIS_PASSWORD, decode_responses=False)

    # Initialize heap on backend startup
    redis_manager = APIKeyHeapManager(r)
    redis_manager.initialize_heap(INITIAL_CONFIGS)

    # Initialize scene queue manager
    scene_queue_manager = SceneQueueManager(r)
    
    print("REDIS and RQ successfully initialized!")
    return redis_manager, scene_queue_manager

def get_redis_manager() -> APIKeyHeapManager:
    """Get the global redis manager instance"""
    if redis_manager is None:
        raise RuntimeError("Redis manager not initialized. Call initializeRedis() first.")
    return redis_manager

def get_scene_queue_manager() -> SceneQueueManager:
    """Get the global scene queue manager instance"""
    if scene_queue_manager is None:
        raise RuntimeError("Scene queue manager not initialized. Call initializeRedis() first.")
    return scene_queue_manager

async def fetch_api_key_with_wait(redis_manager, retry_delay=1, max_wait=60):
    """Keep trying until an API key becomes available."""
    waited = 0
    while True:
        api_config = redis_manager.get_least_used_api_key()

        if api_config:
            return api_config

        if waited >= max_wait:
            raise Exception("Waited too long: No API keys available in heap")

        print("No API key available. Waiting...")
        await asyncio.sleep(retry_delay)
        waited += retry_delay