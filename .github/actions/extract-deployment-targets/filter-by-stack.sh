#!/bin/bash
set -euo pipefail

# Extract deployment targets and filter by stack
TARGETS="${DEPLOYMENT_TARGETS:-[]}"

# Automatically detect all existing stacks
STACKS=$(echo "$TARGETS" | jq -r '.[].stack' | sort -u)

# Dynamically filter targets for each stack
for stack in $STACKS; do
  STACK_TARGETS=$(echo "$TARGETS" | jq -c --arg stack "$stack" '[.[] | select(.stack == $stack)]')
  COUNT=$(echo "$STACK_TARGETS" | jq 'length')
  HAS_TARGETS=$([ $COUNT -gt 0 ] && echo 'true' || echo 'false')

  # Dynamically set outputs
  echo "${stack}_targets=$STACK_TARGETS" >> $GITHUB_OUTPUT
  echo "has_${stack}=$HAS_TARGETS" >> $GITHUB_OUTPUT
done

# Output list of all detected stacks
echo "detected_stacks=$(echo $STACKS | tr '\n' ',' | sed 's/,$//')" >> $GITHUB_OUTPUT
