---
type: article
title: Plugin Proyectos
description: Gestión de proyectos con hitos, tareas, horas y costos, integrada al ERP (Cliente/Empleado ya existentes), no un Kanban aislado.
resource: plugins/proyectos/
tags: [plugin, proyectos, multi-tenant]
timestamp: 2026-11-24T12:29:00Z
aliases: [proyectos]
topic: subprojects
status: stable
sources: [harness bootstrap, 2026-11-24]
score: 6.0
---

# Plugin Proyectos

> Sources: harness bootstrap, 2026-11-24
> Raw: [plugin-proyectos-readme](../../raw/subprojects/plugin-proyectos-readme.md)

## Overview

Gestión de proyectos con hitos, tareas, registro de horas y costos —
modelo "integrado al ERP": un proyecto se arma sobre un `Cliente`
(Contactos) ya cargado, las tareas se asignan a `Empleado`s existentes, y
las horas registradas alimentan el costo interno (derivado de
`Empleado.salarioBrutoMensual`). `plugins/proyectos/` es solo el
manifiesto; implementación real en `backend/src/proyectos/`. Activación
por tenant: clave `proyectos` en `MODULOS_BASE`.

## Fase 1 (entregada)

Modelo de datos `Proyecto` → `HitoProyecto` → `TareaProyecto` (responsables
N:M vía `TareaProyectoResponsable`, horas vía `RegistroHoraProyecto`).
`GastoMenor.proyectoId` opcional reusa el flujo de gastos existente.
Permisos opt-in `proyectos.ver`/`.crear`/`.editar`/`.horas.registrar`.

## Fases futuras (no implementadas)

- Fase 4: generar la `Factura` real de un hito (`PRECIO_FIJO`) o por
  horas trabajadas (`POR_HORAS`), reusando `FacturacionService.crear()`.
- Dashboard de rentabilidad (facturado vs. costo real).
- Notificaciones por Event Bus (hito próximo a vencer, costo sobre
  presupuesto).

## Related

- [Plugin Inmobiliaria](./plugin-inmobiliaria.md) — su Modelo 3 (preventa) reusa este plugin para el plan de pagos.
