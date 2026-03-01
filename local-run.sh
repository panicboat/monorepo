#!/bin/bash

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

pkill -f gruf
pkill -f next

cd "$BASE_DIR/services/monolith/workspace"
bundle install && bin/codegen && bin/grpc &

cd "$BASE_DIR/services/nyx/workspace"
pnpm install && pnpm proto:gen && pnpm dev &

wait
