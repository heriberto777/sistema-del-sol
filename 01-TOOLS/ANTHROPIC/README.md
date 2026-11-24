# ANTHROPIC

API de Claude (Opus, Sonnet, Haiku). Usada por `backend/src/ia/` para
sugerencias — degrada a heurística sin `ANTHROPIC_API_KEY`, nunca bloquea
el flujo que la llama.

## Setup

1. `cp .env.example .env && chmod 600 .env`
2. Generar la key en https://console.anthropic.com/settings/keys
3. `./test_connection.sh` — debería imprimir `OK — N Claude models available.`

## Scripts

| Script | Qué hace |
|--------|----------|
| `test_connection.sh` | Smoke-test contra `GET /v1/models`. |

## Notas

- El backend consume Anthropic vía su propio SDK en runtime
  (`backend/src/ia/`). Esta carpeta es solo para operación manual desde
  terminal (probar la key, ver modelos disponibles).
