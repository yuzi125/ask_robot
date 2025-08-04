import redis

# Create a Redis connection object
r = redis.Redis(
    host='redis',  # Replace with the hostname of your Redis instance
    port=6379,         # Replace with the port of your Redis instance
    decode_responses=True  # Decodes the bytes to string format
)

# Set a key-value pair in Redis
r.set("name", "Stephen")

# Retrieve the value by key
name = r.get("name")

print(f"Name from Redis: {name}")
