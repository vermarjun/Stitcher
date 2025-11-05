import json
from redis import Redis

class APIKeyHeapManager:

    def __init__(self, redis_client:Redis, heap_key="api_keys_heap"):
        self.redis = redis_client
        self.heap_key = heap_key
        self.api_config_key = "api_configs"

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

    def get_heap_size(self):
        return self.redis.zcard(self.heap_key)

    def get_all_emails_sorted(self):
        results = self.redis.zrange(self.heap_key, 0, -1, withscores=True)
        return [
            ((email.decode() if isinstance(email, bytes) else email), score)
            for email, score in results
        ]

# Example usage
# if __name__ == "__main__":
#     # Initialize Redis client
#     r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    
#     # Create heap manager
#     manager = APIKeyHeapManager(r)
    
#     # Sample API configurations to initialize on startup
#     initial_configs = [
#         {
#             'email': 'user1@example.com',
#             'api_key': 'sk-abc123',
#             'tokens_used': 1000,
#             'rate_limit': 10000
#         },
#         {
#             'email': 'user2@example.com',
#             'api_key': 'sk-def456',
#             'tokens_used': 500,
#             'rate_limit': 10000
#         },
#         {
#             'email': 'user3@example.com',
#             'api_key': 'sk-ghi789',
#             'tokens_used': 2000,
#             'rate_limit': 10000
#         },
#         {
#             'email': 'user4@example.com',
#             'api_key': 'sk-jkl012',
#             'tokens_used': 100,
#             'rate_limit': 10000
#         }
#     ]
    
#     # Initialize heap on backend startup
#     manager.initialize_heap(initial_configs)
    
#     print(f"Heap size: {manager.get_heap_size()}")
#     print(f"Current heap state: {manager.get_all_emails_sorted()}")
    
#     # Get least used API key
#     least_used = manager.get_least_used_api_key()
#     print(f"\nLeast used API key: {least_used}")
#     print(f"Heap size after removal: {manager.get_heap_size()}")
    
#     # Simulate usage and return with updated token count
#     if least_used:
#         new_token_count = least_used['tokens_used'] + 50
#         manager.return_api_key(least_used['email'], new_token_count)
#         print(f"\nReturned {least_used['email']} with {new_token_count} tokens")
#         print(f"Heap size after return: {manager.get_heap_size()}")
#         print(f"Updated heap state: {manager.get_all_emails_sorted()}")