#!/bin/bash

pkill -f gruf
pkill -f next

cd services/monolith/workspace
bundle install && bin/codegen && bin/grpc &

cd ../../nyx/workspace
pnpm install && pnpm proto:gen && pnpm dev &

wait
