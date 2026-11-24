# ANTHROPIC — README + CREDENTIALS

> Source: `01-TOOLS/ANTHROPIC/README.md`, `01-TOOLS/ANTHROPIC/CREDENTIALS.md`
> Collected: 2026-11-24
> Published: Unknown

API de Claude (Opus, Sonnet, Haiku). Usada por `backend/src/ia/` para
sugerencias — degrada a heurística sin `ANTHROPIC_API_KEY`, nunca bloquea
el flujo que la llama.

Variables: `ANTHROPIC_API_KEY` (secreto, Dashboard → Settings → API
Keys, rotar ante sospecha de fuga), `ANTHROPIC_MODEL` (público, nombre de
modelo, ej. `claude-sonnet-5`).

Dashboard: https://console.anthropic.com/settings/keys
