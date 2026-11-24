# Credentials — STRIPE

## Dashboard

- URL: https://dashboard.stripe.com/apikeys
- 2FA obligatorio.

## Variables

| Variable | Tipo | Dónde se genera | Rotación |
|----------|------|------------------|----------|
| `STRIPE_SECRET_KEY` | secreto | Dashboard → Developers → API keys | ante sospecha de fuga |
| `STRIPE_WEBHOOK_SECRET` | secreto | Dashboard → Developers → Webhooks → endpoint | cada vez que cambie el endpoint |
| `STRIPE_CURRENCY` | público | n/a — código ISO (default `usd`) | n/a |

## Si se filtra una credencial

1. Revocar de inmediato en el dashboard (rolling key).
2. Generar una nueva y actualizar `.env` local.
3. Actualizar la variable de entorno del despliegue en producción.
