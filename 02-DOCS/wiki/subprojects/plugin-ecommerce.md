---
type: article
title: Plugin Tienda Online (e-commerce)
description: Tienda online del tenant — módulo normal del backend (no un plugin aislado), gateado por el mismo mecanismo de Planes/módulos.
resource: plugins/ecommerce/
tags: [plugin, ecommerce, multi-tenant]
timestamp: 2026-11-24T12:29:00Z
aliases: [ecommerce, tienda-online]
topic: subprojects
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 4.0
---

# Plugin Tienda Online (e-commerce)

> Sources: harness bootstrap, 2026-11-24
> Raw: [plugin-ecommerce-readme](../../raw/subprojects/plugin-ecommerce-readme.md)

## Overview

`plugins/ecommerce/` solo contiene el manifiesto (`plugin.json`) para que
`PluginLoaderService` lo descubra — no hay código ahí. A diferencia de
`plugins/inmobiliaria/` (nunca importado en `AppModule`, `tsconfig.json`
de backend no incluye `plugins/` en su `include` por defecto), la
implementación real de este plugin vive como un módulo normal del backend
— `backend/src/ecommerce/` (`EcommerceModule`, registrado en `AppModule`
como cualquier otro feature).

## Activación

Misma clave `ecommerce` en `Modulo`/`MODULOS_BASE`, gateada por Plan o
`TenantModuloOverride` — mismo mecanismo que el resto del catálogo de
módulos activables.

## Related

- [Plugin Inmobiliaria](./plugin-inmobiliaria.md) — su página pública por subdominio sigue el mismo criterio arquitectónico que la Tienda Online.
