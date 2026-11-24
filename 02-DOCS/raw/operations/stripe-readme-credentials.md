# STRIPE — README + CREDENTIALS

> Source: `01-TOOLS/STRIPE/README.md`, `01-TOOLS/STRIPE/CREDENTIALS.md`
> Collected: 2026-11-24
> Published: Unknown

Operaciones contra la cuenta de Stripe del proyecto: la pasarela de pago
de la suscripción de plataforma (`PASARELA_PAGO_ACTIVA=stripe`, el link
público de pago `/pagar/:facturaId`, el webhook
`POST /api/pagos-publicos/webhook/stripe`). El backend consume Stripe vía
`fetch` nativo (sin SDK oficial). Limitación conocida: Stripe no liquida
en DOP directo — el cobro se hace en `STRIPE_CURRENCY` (default `usd`)
con el mismo monto numérico de la factura, sin conversión de tasa.

Variables: `STRIPE_SECRET_KEY` (secreto, rotar ante fuga),
`STRIPE_WEBHOOK_SECRET` (secreto, rotar si cambia el endpoint),
`STRIPE_CURRENCY` (público, default `usd`).

Dashboard: https://dashboard.stripe.com/apikeys
