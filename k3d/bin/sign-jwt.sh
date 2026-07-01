#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIV="$HERE/infra/jwt/priv.pem"
SUB="${1:-user-123}"
TTL="${2:-3600}"     # seconds; negative value produces an expired token
NOW=$(date +%s)
EXP=$((NOW + TTL))

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
HEADER=$(printf '{"alg":"RS256","typ":"JWT","kid":"local"}' | b64url)
PAYLOAD=$(printf '{"iss":"local","aud":"monolith","sub":"%s","iat":%s,"exp":%s}' "$SUB" "$NOW" "$EXP" | b64url)
SIG=$(printf '%s' "$HEADER.$PAYLOAD" | openssl dgst -sha256 -sign "$PRIV" -binary | b64url)
printf '%s.%s.%s\n' "$HEADER" "$PAYLOAD" "$SIG"
