# TWILIO

Mensajería de WhatsApp: notificaciones (facturas/cotizaciones/estado de
cuenta por WhatsApp), la bandeja de WhatsApp y el bot
(`backend/src/whatsapp-bot/`).

## Setup

1. `cp .env.example .env && chmod 600 .env`
2. `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` desde https://console.twilio.com
   (página principal de la cuenta)
3. `./test_connection.sh` — debería imprimir `OK — Twilio account status: active.`

## Scripts

| Script | Qué hace |
|--------|----------|
| `test_connection.sh` | Smoke-test contra `GET /Accounts/:sid.json`. |

## Notas

- `TWILIO_WHATSAPP_FROM` lleva el prefijo literal `whatsapp:`, ej.
  `whatsapp:+14155238886`.
- El webhook de WhatsApp entrante usa `WHATSAPP_WEBHOOK_URL` (configurado
  en el `.env` del backend, no acá — es la URL pública que Twilio llama,
  no una credencial de Twilio).
