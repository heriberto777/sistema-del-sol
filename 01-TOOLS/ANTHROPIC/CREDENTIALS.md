# Credentials — ANTHROPIC

## Dashboard

- URL: https://console.anthropic.com/settings/keys
- 2FA recomendado.

## Variables

| Variable | Tipo | Dónde se genera | Rotación |
|----------|------|------------------|----------|
| `ANTHROPIC_API_KEY` | secreto | Dashboard → Settings → API Keys | ante sospecha de fuga |
| `ANTHROPIC_MODEL` | público | n/a — nombre de modelo (ej. `claude-sonnet-5`) | n/a |

## Si se filtra una credencial

1. Revocar de inmediato en el dashboard.
2. Generar una nueva y actualizar `.env` local.
3. Actualizar la variable de entorno del despliegue en producción.
