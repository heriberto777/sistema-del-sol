---
type: article
title: Plugin Inmobiliaria
description: Catálogo de propiedades integrado a Contactos/Empleados, con tres modelos de negocio entregados — venta/alquiler, administradora de alquileres, y preventa reusando el plugin Proyectos.
resource: plugins/inmobiliaria/
tags: [plugin, inmobiliaria, multi-tenant]
timestamp: 2026-11-24T12:29:00Z
aliases: [inmobiliaria]
topic: subprojects
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 8.0
---

# Plugin Inmobiliaria

> Sources: harness bootstrap, 2026-11-24
> Raw: [plugin-inmobiliaria-readme](../../raw/subprojects/plugin-inmobiliaria-readme.md)

## Overview

Catálogo de propiedades (venta/alquiler) para agencias inmobiliarias,
integrado a `Contactos`/`Empleados` existentes — no un sistema aislado.
`plugins/inmobiliaria/` es solo el manifiesto que lee `PluginLoaderService`
al boot; la implementación real vive en `backend/src/inmobiliaria/`.
Activación por tenant: clave `inmobiliaria` en `MODULOS_BASE`, vía Plan o
`TenantModuloOverride` (nunca la activa el propio tenant).

## Modelo 1 — Agencia de venta/alquiler (completo, 4 fases)

`Propiedad` + `ImagenPropiedad` (galería), CRUD administrativo completo,
página pública por subdominio (`/inmobiliaria/:subdominio`, mismo
criterio que la Tienda Online), `ContratoPropiedad` con comisión al
agente calculada de forma autónoma (no reusa `ComisionVenta`), y
comparador/calculadora de hipoteca/favoritos/alertas de búsqueda
guardada en el catálogo público.

## Modelo 2 — Administradora de alquileres (completo)

`Propiedad.propietarioId` distinto del `agenteId`. `CobroAlquiler`
mensual por contrato administrado (PENDIENTE → COBRADO → LIQUIDADO),
generado solo por un cron diario. Al cobrar, el admin elige facturarlo
(reusa `FacturacionService.crear()`) o dejarlo como registro interno.

## Modelo 3 — Preventa (completo, reusa Proyectos)

Sin sistema de hitos propio: `Propiedad.proyectoPreventaId` vincula a un
`Proyecto` del plugin Proyectos (`modoFacturacion: PRECIO_FIJO`) — cada
pago es un `HitoProyecto`, facturado 100% desde la pantalla ya existente
de Proyectos. Exige que el tenant tenga también el módulo `proyectos`
activo.

## Tests

e2e con 30 casos de aislamiento entre tenants en los tres modelos,
cubriendo ambos mecanismos de scoping (`TenantPrismaService` admin y
`PrismaService` + tenantId a mano en el catálogo público) y los IDOR de
`agenteId`/`clienteId`/`propietarioId` cruzados.

## Related

- [Plugin Proyectos](./plugin-proyectos.md) — el Modelo 3 (preventa) depende de que el tenant tenga este módulo activo.
