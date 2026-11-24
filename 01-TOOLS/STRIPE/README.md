# STRIPE

Operaciones contra la cuenta de Stripe del proyecto: la pasarela de pago
de la suscripción de plataforma (`PASARELA_PAGO_ACTIVA=stripe`, el link
público de pago `/pagar/:facturaId`, el webhook
`POST /api/pagos-publicos/webhook/stripe`).

## Setup

1. `cp .env.example .env && chmod 600 .env`
2. `STRIPE_SECRET_KEY` desde https://dashboard.stripe.com/apikeys
3. `./test_connection.sh` — debería imprimir `OK — account: acct_…`

## Scripts

| Script | Qué hace |
|--------|----------|
| `test_connection.sh` | Smoke-test contra `GET /v1/account`. |

## Notas

- El backend consume Stripe vía `fetch` nativo (sin SDK oficial, mismo
  criterio que `IaClientService` con Anthropic) — `StripeAdapter`.
- **Limitación conocida**: Stripe no liquida en DOP directo — el cobro se
  hace en `STRIPE_CURRENCY` (default `usd`) con el mismo monto numérico
  de la factura, sin conversión de tasa de cambio.
- El webhook verifica la firma a mano (HMAC-SHA256, `stripe-webhook.util.ts`)
  — `STRIPE_WEBHOOK_SECRET` tiene que coincidir con el endpoint configurado
  en el dashboard.
