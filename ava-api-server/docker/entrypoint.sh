#!/bin/bash
set -e
gunicorn --config ./ava-api-server/ava/gunicorn_config.py --bind "${AVA_BIND_ADDRESS:-0.0.0.0}:${AVA_PORT:-5001}" --workers ${SERVER_WORKER_AMOUNT:-2} --worker-class ${SERVER_WORKER_CLASS:-gevent} --timeout ${GUNICORN_TIMEOUT:-200} ava.app:app

