---
type: article
title: STRIPE (operaciones)
description: Pasarela de pago de la suscripción de plataforma — link público de pago y webhook con firma verificada a mano.
resource: 01-TOOLS/STRIPE/
tags: [operations, pagos, stripe]
timestamp: 2026-11-24T12:29:00Z
aliases: [stripe]
topic: operations
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 6.0
---

# STRIPE (operaciones)

> Sources: harness bootstrap, 2026-11-24
> Raw: [stripe-readme-credentials](../../raw/operations/stripe-readme-credentials.md)

## Overview

Pasarela de pago de la suscripción de plataforma (lo que la plataforma le
cobra a cada tenant, no lo que un tenant le cobra a sus clientes). El
admin del tenant paga desde un link público sin autenticación
(`/pagar/:facturaId`), vía `PasarelaPagoAdapter`/`StripeAdapter`
(`backend/src/facturacion-plataforma/pasarela/`). El backend consume
Stripe con `fetch` nativo, sin SDK oficial — mismo criterio que
`IaClientService` con Anthropic.

## Credenciales

- `STRIPE_SECRET_KEY` (secreto) — rotar ante sospecha de fuga.
- `STRIPE_WEBHOOK_SECRET` (secreto) — rotar si cambia el endpoint.
- `STRIPE_CURRENCY` (público, default `usd`).

## Limitación conocida

Stripe no liquida en DOP directo — el cobro se hace en `STRIPE_CURRENCY`
con el mismo monto numérico de la factura, sin conversión de tasa de
cambio.

## Webhook

`POST /api/pagos-publicos/webhook/stripe` verifica la firma a mano
(HMAC-SHA256, `stripe-webhook.util.ts`) y llama
`PagosPlataformaService.registrarPagoGateway` (idempotente — Stripe
reintenta si no recibe 200).

## Related

- [01-TOOLS — resumen](./01-tools-overview.md)
- [Control plane — Sistema del Sol](../meta/control-plane.md) — contexto completo de Suscripción y facturación de plataforma.
