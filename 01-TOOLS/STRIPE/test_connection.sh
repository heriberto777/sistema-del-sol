#!/usr/bin/env bash
# Smoke-test against Stripe API: GET /v1/account.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PATH="$SCRIPT_DIR/.env"
[ -f "$ENV_PATH" ] || { echo "ERROR: missing $ENV_PATH" >&2; exit 1; }
set -a; source "$ENV_PATH"; set +a
: "${STRIPE_SECRET_KEY:?STRIPE_SECRET_KEY not set in $ENV_PATH}"
RESP=$(curl -fsS -u "$STRIPE_SECRET_KEY:" https://api.stripe.com/v1/account)
echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"OK — account: {d[\"id\"]} ({d.get(\"business_profile\",{}).get(\"name\",\"-\")})")'
