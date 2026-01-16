import json
from datetime import datetime
from app.utils.initialize_redis import get_scene_queue_manager

def publish_event(chat_id: str, event_type: str, data: dict):
    """
    Publish an event to the Redis channel 'chat:{chat_id}'.
    This is used to send real-time updates to the API/Frontend.
    """
    try:
        # Get the Redis client from the existing manager
        manager = get_scene_queue_manager()
        redis_client = manager.redis
        
        payload = {
            "type": event_type,
            "data": data,
            "chatId": chat_id,
            "timestamp": datetime.now().isoformat()
        }
        
        channel = f"chat:{chat_id}"
        redis_client.publish(channel, json.dumps(payload))
        print(f"[EventPublisher] Published {event_type} to {channel}")
            
    except Exception as e:
        print(f"[EventPublisher] Failed to publish event: {e}")
