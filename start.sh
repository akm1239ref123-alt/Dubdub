#!/bin/sh
PORT=${PORT:-3000}
python3 -m http.server "$PORT" --bind 0.0.0.0
