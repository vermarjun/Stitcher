import json
from redis import Redis

class APIKeyHeapManager:

    def __init__(self, redis_client:Redis, heap_key="api_keys_heap"):
        self.redis = redis_client
        self.heap_key = heap_key
        self.api_config_key = "api_configs"
        # Queue-based system properties
        self.request_queue_key = f"{heap_key}_requests"
        self.notify_channel = f"{heap_key}_available"

    def initialize_heap(self, api_configs):
        self.redis.delete(self.heap_key)

        for config in api_configs:
            email = config["email"]
            tokens_used = config.get("tokens_used", 0)

            self.redis.hset(
                self.api_config_key,
                email,
                json.dumps(config)
            )

            self.redis.zadd(self.heap_key, {email: tokens_used})

    def get_least_used_api_key(self):
        result = self.redis.zpopmin(self.heap_key, count=1)

        if not result:
            return None

        email, _tokens = result[0]
        if isinstance(email, bytes):
            email = email.decode()

        config_json = self.redis.hget(self.api_config_key, email)

        if config_json:
            return json.loads(config_json)

        return None

    def return_api_key(self, email, tokens_used):
        self.redis.zadd(self.heap_key, {email: tokens_used})
        # Notify waiting requests that a key is available
        self.notify_waiting_requests()

    def update_token_usage(self, email, new_tokens_used):
        self.redis.zadd(self.heap_key, {email: new_tokens_used})

        config_json = self.redis.hget(self.api_config_key, email)
        if config_json:
            config = json.loads(config_json)
            config["tokens_used"] = new_tokens_used
            self.redis.hset(
                self.api_config_key,
                email,
                json.dumps(config)
            )
        
        # Notify waiting requests that a key is available
        self.notify_waiting_requests()

    def get_heap_size(self):
        return self.redis.zcard(self.heap_key)

    def get_all_emails_sorted(self):
        results = self.redis.zrange(self.heap_key, 0, -1, withscores=True)
        return [
            ((email.decode() if isinstance(email, bytes) else email), score)
            for email, score in results
        ]
    
    # ===================================================================
    # Queue Management Methods
    # ===================================================================
    
    def get_queue_size(self):
        """Get number of waiting requests in queue"""
        return self.redis.llen(self.request_queue_key)
    
    def add_to_queue(self, request_id: str):
        """Add a request to the waiting queue"""
        self.redis.rpush(self.request_queue_key, request_id)
    
    def remove_from_queue(self, request_id: str):
        """Remove a request from the waiting queue"""
        self.redis.lrem(self.request_queue_key, 0, request_id)
    
    def notify_waiting_requests(self):
        """Notify waiting requests that an API key is available"""
        queue_size = self.get_queue_size()
        if queue_size > 0:
            # Publish notification - waiting agents will compete for the key
            self.redis.publish(self.notify_channel, "key_available")
            print(f"[Queue] Notified {queue_size} waiting request(s) in {self.heap_key}")
            return True
        return False