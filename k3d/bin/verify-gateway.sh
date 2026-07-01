#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0
run() { kubectl run "tmp-verify-$RANDOM" --rm -i --restart=Never --image=curlimages/curl:8.11.0 -- "$@"; }

TOKEN=$("$HERE/bin/sign-jwt.sh" user-123)
EXPIRED=$("$HERE/bin/sign-jwt.sh" user-123 -3600)

echo "== case 1: valid JWT -> 200 + x-user-id"
body=$(run curl -s -H "Authorization: Bearer $TOKEN" http://echo/)
body=$(printf '%s' "$body" | sed 's/pod .*//')
uid=$(printf '%s' "$body" | jq -r '.request.headers["x-user-id"] // empty')
if [ "$uid" = "user-123" ]; then echo "  PASS (x-user-id=$uid)"; else echo "  FAIL (x-user-id=$uid)"; fail=1; fi

echo "== case 2: expired JWT -> 401"
code=$(run curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $EXPIRED" http://echo/)
code=$(printf '%s' "$code" | sed 's/[^0-9].*//')
if [ "$code" = "401" ]; then echo "  PASS (401)"; else echo "  FAIL ($code)"; fail=1; fi

echo "== case 3: no JWT -> 401"
code=$(run curl -s -o /dev/null -w "%{http_code}" http://echo/)
code=$(printf '%s' "$code" | sed 's/[^0-9].*//')
if [ "$code" = "401" ]; then echo "  PASS (401)"; else echo "  FAIL ($code)"; fail=1; fi

[ "$fail" = "0" ] && echo "ALL PASS" || { echo "FAILED"; exit 1; }
