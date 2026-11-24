# TWILIO — README + CREDENTIALS

> Source: `01-TOOLS/TWILIO/README.md`, `01-TOOLS/TWILIO/CREDENTIALS.md`
> Collected: 2026-11-24
> Published: Unknown

Mensajería de WhatsApp: notificaciones (facturas/cotizaciones/estado de
cuenta por WhatsApp), la bandeja de WhatsApp y el bot
(`backend/src/whatsapp-bot/`). `TWILIO_WHATSAPP_FROM` lleva el prefijo
literal `whatsapp:`. El webhook de WhatsApp entrante usa
`WHATSAPP_WEBHOOK_URL` (variable del backend, no de Twilio).

Variables: `TWILIO_ACCOUNT_SID` (público), `TWILIO_AUTH_TOKEN` (secreto,
rotar ante fuga), `TWILIO_WHATSAPP_FROM` (público, Senders).

Dashboard: https://console.twilio.com
