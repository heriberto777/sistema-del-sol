# Credentials — TWILIO

## Dashboard

- URL: https://console.twilio.com
- Account SID + Auth Token están en la página principal de la cuenta.

## Variables

| Variable | Tipo | Dónde se genera | Rotación |
|----------|------|------------------|----------|
| `TWILIO_ACCOUNT_SID` | público | Dashboard → página principal | n/a |
| `TWILIO_AUTH_TOKEN` | secreto | Dashboard → página principal (botón "ver") | ante sospecha de fuga |
| `TWILIO_WHATSAPP_FROM` | público | Dashboard → Messaging → Senders | n/a |

## Si se filtra una credencial

1. Revocar/regenerar el Auth Token de inmediato en el dashboard.
2. Actualizar `.env` local y la variable de entorno del despliegue.
