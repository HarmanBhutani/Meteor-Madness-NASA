import json

# Simple in-memory fallback cache for local testing
_cache = {}

class Cache:
    def get(self, key):
        return json.loads(_cache[key]) if key in _cache else None

    def set(self, key, value):
        _cache[key] = json.dumps(value)

cache = Cache()
