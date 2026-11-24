---
type: article
title: ANTHROPIC (operaciones)
description: Claude API usada por backend/src/ia/ — degrada a heurística sin API key, nunca bloquea el flujo que la llama.
resource: 01-TOOLS/ANTHROPIC/
tags: [operations, ia, anthropic]
timestamp: 2026-11-24T12:29:00Z
aliases: [anthropic]
topic: operations
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 6.0
---

# ANTHROPIC (operaciones)

> Sources: harness bootstrap, 2026-11-24
> Raw: [anthropic-readme-credentials](../../raw/operations/anthropic-readme-credentials.md)

## Overview

API de Claude (Opus, Sonnet, Haiku), consumida por `backend/src/ia/` para
sugerencias. Sin `ANTHROPIC_API_KEY`, cada endpoint de `/ia` degrada a un
modo heurístico — nunca falla la request que la usa.

## Credenciales

- `ANTHROPIC_API_KEY` (secreto) — https://console.anthropic.com/settings/keys, rotar ante sospecha de fuga.
- `ANTHROPIC_MODEL` (público) — nombre de modelo, ej. `claude-sonnet-5`.

## Operación

`01-TOOLS/ANTHROPIC/test_connection.sh` hace un smoke-test contra
`GET /v1/models`. El backend consume Anthropic vía su propio SDK en
runtime — esta carpeta es solo para operación manual desde terminal.

## Related

- [01-TOOLS — resumen](./01-tools-overview.md)
