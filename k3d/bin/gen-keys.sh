#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JWT_DIR="$HERE/infra/jwt"
mkdir -p "$JWT_DIR"
KID=local

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# Generate a 2048-bit RSA private key (re-running is idempotent)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$JWT_DIR/priv.pem" 2>/dev/null

# Encode modulus (n) as base64url; exponent (e) is always 65537 = AQAB
MOD_HEX=$(openssl rsa -in "$JWT_DIR/priv.pem" -noout -modulus | sed 's/Modulus=//')
N=$(printf '%s' "$MOD_HEX" | xxd -r -p | b64url)
cat > "$JWT_DIR/jwks.json" <<EOF
{"keys":[{"kty":"RSA","kid":"$KID","alg":"RS256","use":"sig","n":"$N","e":"AQAB"}]}
EOF
echo "wrote $JWT_DIR/priv.pem (gitignored) and $JWT_DIR/jwks.json"
