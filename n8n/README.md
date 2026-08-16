# Workflows de n8n

Plantillas verificadas (importadas y re-exportadas contra una instancia
real de n8n 2.21.7 — no solo generadas a mano) para las dos integraciones
sugeridas en la especificación original. Ya vienen cargadas en el volumen
`n8n_data` de `docker-compose.yml` si usaste este scaffold desde el
principio; si no, importalas manualmente (ver abajo).

## 1. Alerta de stock bajo (`alerta-stock-bajo.json`)

**Qué hace:** escucha un webhook, verifica su firma HMAC, y manda un
mensaje a Slack cuando `InventarioService` emite `inventario.stock_bajo`.

**Cómo conectarlo:**

1. En n8n, abrí el workflow, activá el nodo **Webhook Sol** y copiá su URL
   (algo como `http://localhost:5678/webhook/stock-bajo`).
2. En El Sistema del Sol, como admin del tenant: `POST /api/webhooks` con
   `{ "url": "<esa URL>", "eventos": ["inventario.stock_bajo"] }` — la
   respuesta trae un `secret`.
3. Pegá ese `secret` en el nodo **Verificar firma HMAC**, reemplazando
   `REEMPLAZA_CON_EL_SECRET_DEL_WEBHOOK`.
4. En el nodo **Enviar a Slack**, reemplazá la URL por tu propio
   [Incoming Webhook de Slack](https://api.slack.com/messaging/webhooks)
   — o cambiá ese nodo por un Email/Telegram/WhatsApp si preferís otro
   canal, el resto del workflow no cambia.
5. Activá el workflow.

## 2. Reporte de ventas diario (`reporte-ventas-diario.json`)

**Qué hace:** todos los días a las 7am, trae las facturas del día vía
`GET /api/facturas` y manda un resumen (cantidad + total vendido) por
email.

**Cómo conectarlo:**

1. En el nodo **Traer facturas del día**, reemplazá
   `REEMPLAZA_CON_UN_TOKEN_DE_SERVICIO` por un JWT válido. Como los
   tokens normales expiran en `JWT_EXPIRATION` (24h por defecto), para
   este uso conviene:
   - crear un usuario dedicado (ej. `n8n@tuempresa.com`) con el rol
     mínimo necesario (`facturacion.ver`), y
   - o bien generar un token de vida larga a mano para ese usuario, o
     agregar un paso previo en el workflow que haga login
     (`POST /api/auth/login`) antes de pedir las facturas — más robusto,
     pero no está resuelto en esta plantilla; queda como el ajuste más
     importante antes de usar esto en producción.
2. Configurá una credencial SMTP en n8n (Settings → Credentials → SMTP)
   y asignásela al nodo **Enviar reporte por email**, y reemplazá
   `REEMPLAZA_CON_TU_CORREO` por el destinatario real.
3. Activá el workflow.

## Importar manualmente (si no vinieron precargados)

```bash
# Copia el archivo dentro del contenedor y usa el CLI de n8n
docker cp n8n/workflows/alerta-stock-bajo.json sistema-del-sol-n8n-1:/tmp/wf.json
docker exec sistema-del-sol-n8n-1 n8n import:workflow --input=/tmp/wf.json
```

O desde la UI de n8n: **Workflows → Import from File**.

## Por qué estos dos primero

Son los dos casos de la especificación original que no dependen de nada
que no exista ya en el scaffold (el sistema de webhooks con firma HMAC, y
el endpoint de facturas) — a diferencia de, por ejemplo, "sync a
Pipedrive" o "export a banco", que requieren credenciales/contratos de
terceros que todavía no están definidos.
