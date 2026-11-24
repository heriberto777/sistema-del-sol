#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PATH="$SCRIPT_DIR/.env"
[ -f "$ENV_PATH" ] || { echo "ERROR: missing $ENV_PATH" >&2; exit 1; }
set -a; source "$ENV_PATH"; set +a
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY not set in $ENV_PATH}"
N=$(curl -fsS https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["data"]))')
echo "OK — $N Claude models available."
