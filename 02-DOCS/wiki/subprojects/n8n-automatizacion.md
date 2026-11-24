---
type: article
title: Automatización con n8n
description: Dos workflows n8n verificados — alerta de stock bajo y reporte de ventas diario — conectados al Event Bus y la API del backend.
resource: n8n/
tags: [automatizacion, webhooks, n8n]
timestamp: 2026-11-24T12:29:00Z
aliases: [n8n, workflows-n8n]
topic: subprojects
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 4.0
---

# Automatización con n8n

> Sources: harness bootstrap, 2026-11-24
> Raw: [n8n-readme](../../raw/subprojects/n8n-readme.md)

## Overview

`n8n/workflows/` trae dos plantillas verificadas (importadas/re-exportadas
contra n8n 2.21.7 real) que cubren los dos casos de la especificación
original que no dependen de credenciales de terceros todavía sin definir.
Se cargan solas en el volumen `n8n_data` de `docker-compose.yml` si se usó
el scaffold desde el principio.

## 1. Alerta de stock bajo (`alerta-stock-bajo.json`)

Escucha un webhook con firma HMAC verificada y manda un mensaje a Slack
cuando `InventarioService` emite el evento `inventario.stock_bajo` (Event
Bus). Conexión: crear un webhook del tenant (`POST /api/webhooks` con
`eventos: ["inventario.stock_bajo"]`), pegar el `secret` devuelto en el
nodo "Verificar firma HMAC", y apuntar el nodo "Enviar a Slack" a un
Incoming Webhook propio (o cambiarlo por Email/Telegram/WhatsApp).

## 2. Reporte de ventas diario (`reporte-ventas-diario.json`)

Todos los días a las 7am trae las facturas del día (`GET /api/facturas`)
y manda un resumen por email. Punto abierto, no resuelto en la plantilla:
el JWT normal expira en 24h (`JWT_EXPIRATION`) — para uso en producción
conviene un usuario dedicado de n8n con rol mínimo (`facturacion.ver`) y
o un token de vida larga, o un paso previo de login en el workflow.

## Importar manualmente

```bash
docker cp n8n/workflows/alerta-stock-bajo.json sistema-del-sol-n8n-1:/tmp/wf.json
docker exec sistema-del-sol-n8n-1 n8n import:workflow --input=/tmp/wf.json
```

O desde la UI: Workflows → Import from File.

## Related

- Ambos workflows dependen del sistema de Webhooks con firma HMAC y del
  Event Bus descritos en el control plane del proyecto — ver
  [Control plane — Sistema del Sol](../meta/control-plane.md).
