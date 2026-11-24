#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PATH="$SCRIPT_DIR/.env"
[ -f "$ENV_PATH" ] || { echo "ERROR: missing $ENV_PATH" >&2; exit 1; }
set -a; source "$ENV_PATH"; set +a
: "${TWILIO_ACCOUNT_SID:?TWILIO_ACCOUNT_SID not set in $ENV_PATH}"
: "${TWILIO_AUTH_TOKEN:?TWILIO_AUTH_TOKEN not set in $ENV_PATH}"
STATUS=$(curl -fsS "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json" -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
echo "OK — Twilio account status: $STATUS."
