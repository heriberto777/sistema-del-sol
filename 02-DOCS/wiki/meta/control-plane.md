---
type: article
title: Control plane — Sistema del Sol
description: Qué es el proyecto y cómo está organizado su control plane — stack, multi-tenancy, RBAC, planes/módulos, facturación de plataforma, plugin system.
resource: CLAUDE.md
tags: [meta, control-plane, arquitectura]
timestamp: 2026-11-24T12:29:00Z
aliases: [claude-md, agents-md, proyecto-overview]
topic: meta
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 6.0
---

# Control plane — Sistema del Sol

> Sources: harness bootstrap, 2026-11-24
> Raw: [claude-md](../../raw/meta/claude-md.md); [agents-md](../../raw/meta/agents-md.md)

## Overview

Sistema del Sol es un SaaS multi-tenant de facturación para República
Dominicana (NCF/ITBIS), con inventario, precios, compras, contabilidad de
partida doble, nómina y POS, extensible vía plugins (inmobiliaria,
proyectos, ecommerce, publicaciones sociales). Backend NestJS + Prisma +
PostgreSQL, frontend React + Vite + TailwindCSS, workspace pnpm (un único
repo Git en la raíz, no multi-repo).

> El detalle profundo (razón de cada decisión no obvia) vive en
> `docs/ARCHITECTURE.md` y el resto de `docs/` — ese cuerpo de ~12.9K
> líneas todavía no se barrió a esta wiki (ver gap abierto en
> `wiki/gaps.md`, "docs/ — documentación técnica preexistente"). Este
> artículo es el resumen de control plane, no el reemplazo de `docs/`.

## Multi-tenancy

Una sola base Postgres, `tenantId` en cada tabla de negocio, dos capas de
aislamiento: `TenantPrismaService` (aplicación, la que realmente protege
hoy, request-scoped, inyecta `tenantId` automático) + RLS a nivel de
Postgres (defensa en profundidad, rol restringido `sol_app`). Las tablas
"hijas" sin `tenantId` propio (`stock`, `precios`, `linea_factura`, …)
necesitan validar el padre explícitamente antes de tocarlas — fue un IDOR
real en el pasado. Con RLS activo, cualquier query necesita `SET LOCAL
app.tenant_id` en la MISMA conexión/transacción.

## RBAC y Auth

Roles fijos sembrados por tenant, permisos vía `@Permissions('modulo.accion')`
+ `PermissionsGuard`. El frontend filtra sidebar/botones por UX, nunca
como seguridad real. Dos sistemas de auth separados sin cruce: tenant
(`JwtAuthGuard`, secreto `JWT_SECRET`) y plataforma/super admin
(`PlatformAuthGuard`, secreto `PLATFORM_JWT_SECRET`, sin `tenantId`). El
RBAC de plataforma es un catálogo global aparte
(`PlatformRole`/`PlatformPermission`), con su guard aplicado junto a
`PlatformAuthGuard` en cada controller (nunca global vía `APP_GUARD`, a
propósito).

## Planes y módulos activables por tenant

Qué módulos ve/usa cada tenant lo decide la plataforma (super admin), no
el tenant: `Plan` (catálogo global) + `TenantModuloOverride` (override
puntual, siempre gana sobre el plan). Contabilidad, Contactos, Reportes,
Notificaciones y Admin quedan siempre activos, sin excepción.

## Suscripción y facturación de plataforma

Lo que la plataforma le cobra a cada tenant (no confundir con `Factura`,
lo que un tenant le cobra a sus clientes). `Suscripcion` 1:1 por tenant,
`FacturasPlataformaCronService` diario genera/vence facturas según
`Plan.cicloFacturacion`. Pasarela de pago vía link público sin auth
(`/pagar/:facturaId`) — ver [STRIPE](../operations/stripe.md).

## Subproyectos fuera del backend/frontend

Además de los plugins activables (ver abajo), el workspace trae
[Agente de Caja](../subprojects/agente-caja.md) (app standalone que abre
la gaveta física del POS) y [Automatización con n8n](../subprojects/n8n-automatizacion.md)
(workflows de alerta de stock bajo y reporte de ventas diario).

## Plugin system

Cada plugin vive en `plugins/<nombre>/` con su propio módulo NestJS,
importado a mano en `app.module.ts` (un solo proceso compilado, no
microservicios). Activación por tenant con el mismo mecanismo de
Planes/módulos. Ver los plugins entregados:
[Inmobiliaria](../subprojects/plugin-inmobiliaria.md),
[Proyectos](../subprojects/plugin-proyectos.md),
[Ecommerce](../subprojects/plugin-ecommerce.md),
[Publicaciones Sociales](../subprojects/plugin-publicaciones-sociales.md).

## Convenciones de código

Backend: `Controller → Service → Repository` por módulo, solo el
repositorio toca Prisma. Nombres en español, alineados al dominio.
Frontend: Atomic Design, Crear/Editar/Ver de cualquier entidad va en
página con ruta propia — **nunca en un modal** (regla permanente,
excepciones: confirmaciones sin formulario, alta rápida embebida,
mensajería, previsualizar-antes-de-confirmar, asistente que arma un
borrador para otro formulario). Listados que pueden crecer sin límite
siguen el contrato `ListadoQueryDto`/`PaginaResultado<T>`.

## Tests

Unitarios (`*.spec.ts`, mockeando repos/event bus) para lógica de negocio
real. e2e (Postgres real vía docker-compose) para el camino HTTP completo
y, en particular, aislamiento real entre tenants — la red que atrapó dos
bugs reales de scoping/guard en el pasado.

## Related

- [01-TOOLS — resumen operativo](../operations/01-tools-overview.md)
- [ANTHROPIC](../operations/anthropic.md), [STRIPE](../operations/stripe.md), [TWILIO](../operations/twilio.md)
