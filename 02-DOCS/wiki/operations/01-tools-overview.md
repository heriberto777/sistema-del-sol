---
type: article
title: 01-TOOLS — resumen operativo
description: Catálogo de herramientas operativas por proveedor externo (credenciales + smoke-test), separado del runtime del producto.
resource: 01-TOOLS/
tags: [operations, tooling]
timestamp: 2026-11-24T12:29:00Z
aliases: [01-tools]
topic: operations
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 12.0
---

# 01-TOOLS — resumen operativo

> Sources: harness bootstrap, 2026-11-24
> Raw: [01-tools-readme](../../raw/operations/01-tools-readme.md)

## Overview

`01-TOOLS/` es el arsenal operativo del proyecto: una carpeta por
proveedor externo, cada una con su propio `.env` real (gitignored),
`CREDENTIALS.md` y un `test_connection.sh` como smoke-test. Es
**operación, no runtime** — los scripts acá son los que corre un
operador desde terminal; el SDK que el producto consume en producción
vive en `backend/src/`.

## Catálogo actual

| Herramienta | Categoría | Para qué |
|-------------|-----------|----------|
| [ANTHROPIC](./anthropic.md) | ia | Claude API — `backend/src/ia/` |
| [STRIPE](./stripe.md) | pagos | Pasarela de pago de la suscripción de plataforma |
| [TWILIO](./twilio.md) | comunicación | Mensajería de WhatsApp |

## Proveedores reales sin carpeta todavía

CARDNET, AZUL (pasarelas locales de RD, hoy stubs), DUFFEL (API de
viajes, plugin Travel), ALANUBE (e-CF/DGII) — reales en el código, pero
fuera del catálogo de la skill `harness` (`providers.yaml`). No se
fabrica una carpeta especulativa para ellos; se agregan puntuales con la
skill `connect-tool` si hace falta operarlos desde terminal.

## Filosofía

Sin herramientas especulativas (se agrega una cuando la integración ya
está en runtime o hay una operación manual recurrente que duele).
Smoke-test primero. Co-ubicación de credenciales y scripts.

## Related

- [ANTHROPIC](./anthropic.md), [STRIPE](./stripe.md), [TWILIO](./twilio.md)
