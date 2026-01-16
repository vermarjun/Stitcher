#!/bin/bash

# Start the RQ worker listening on the 'scene_rendering' queue
# Using the Redis URL provided in the environment/logs

echo "Starting RQ worker for queue: scene_rendering"
rq worker scene_rendering -u redis://default:REDACTED_REDIS_PASSWORD@redis-17374.c270.us-east-1-3.ec2.cloud.redislabs.com:17374
