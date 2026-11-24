---
type: article
title: Plugin Publicaciones Sociales
description: Fábrica de contenido de marketing a partir del catálogo de productos, con aprobación humana obligatoria — nunca publica directo en redes.
resource: plugins/publicaciones-sociales/
tags: [plugin, marketing, ia, multi-tenant]
timestamp: 2026-11-24T12:29:00Z
aliases: [publicaciones-sociales]
topic: subprojects
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 6.0
---

# Plugin Publicaciones Sociales

> Sources: harness bootstrap, 2026-11-24
> Raw: [plugin-publicaciones-sociales-readme](../../raw/subprojects/plugin-publicaciones-sociales-readme.md)

## Overview

Genera diseños de marketing (banners) a partir del catálogo de productos.
**Nunca publica directo en redes sociales** — eso exigiría OAuth por
tenant + revisión de Meta/TikTok, un trámite externo fuera de alcance.
En cambio: genera el diseño, un responsable lo aprueba o rechaza dentro
de la plataforma, y una vez aprobado el tenant lo descarga o lo manda por
WhatsApp (acciones manuales, nunca automáticas). Implementación real en
`backend/src/publicaciones-sociales/`; `plugins/publicaciones-sociales/`
es solo el manifiesto. Activación: clave `publicacionessociales` en
`MODULOS_BASE`.

## Fase 1 — solo imagen (entregada)

`PlantillaPublicacionSocial` (catálogo global) → `PublicacionSocial`
(`BORRADOR → PENDIENTE_APROBACION → APROBADA|RECHAZADA`). Generación
server-side con `@napi-rs/canvas`, 3 plantillas fijas (`precio-destacado`,
`minimalista`, `oferta`), 1080×1080.

## Fase 2 — fondo por IA (entregada, superada por Fase 3)

Prompt opcional manda la foto real del producto a Gemini
(`gemini-3-pro-image-preview`, default) u OpenAI (`gpt-image-1.5`) —
`backend/src/ia/generador-fondo/`. Claude no participa en generación de
imágenes. Límite fijo de generaciones IA por tenant/mes
(`PlataformaConfiguracion.iaFondoLimiteMensual`, default 20, costo lo
paga la plataforma).

## Fase 3 — la IA diseña la pieza completa (entregada)

Bug real: si el prompt pedía su propio texto de precio, la imagen salía
con dos precios superpuestos. Fix: cuando se usa IA, la IA diseña la
pieza COMPLETA (precio/oferta/nombre reales, vía
`OfertasService.resolverOfertaVisibleProducto` — la misma lógica que la
venta real) — nunca se vuelve a superponer Canvas encima. El camino sin
IA (Fase 1) no cambió.

## Fase 4 — formato por red + presets de estilo (entregada)

`formato` (`CUADRADO`/`VERTICAL`) en `PublicacionSocial`. `VERTICAL`
(9:16) solo disponible generando con IA — las plantillas fijas de Canvas
están maquetadas para 1080×1080. Presets de estilo 100% frontend, sin
tocar backend.

## Fase 5 — aviso de aprobación + pedido de cambios (entregada)

Email (4 eventos nuevos vía Event Bus, destinatarios resueltos por
permiso real `publicacionessociales.aprobar`) + WhatsApp opcional (número
del tenant, botones "Aprobar"/"Ver detalle", interceptado en
`WhatsappWebhookController` antes del bot conversacional). Nuevo estado
no-terminal `CAMBIOS_SOLICITADOS` (regenera y vuelve a `BORRADOR`).
Historial de versiones (`PublicacionSocialVersion`, nunca se pisa).

**Bug real encontrado probando en vivo**: `WhatsappConfigRepository` usaba
`TenantPrismaService` (request-scoped) desde un `@OnEvent`/webhook
público — revienta el proceso entero. Fix: `this.prisma` (global) directo
en ambos casos.

## Fases futuras (a propósito no implementadas)

Video (reels/shorts, necesita cola de trabajos en segundo plano),
rechazar/pedir cambios por WhatsApp con texto libre, publicación directa
en redes (fuera de alcance), variantes de fondo IA antes de guardar,
límite configurable por tenant, formato vertical para las plantillas
fijas de Canvas.

## Related

- Reusa la infraestructura de WhatsApp (Twilio) — ver
  [TWILIO](../operations/twilio.md).
