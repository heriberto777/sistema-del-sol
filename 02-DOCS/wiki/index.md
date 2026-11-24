# Knowledge Base Index

> **OKF v0.1 reserved file** — `index.md` carries **no frontmatter** (it is a
> directory listing for progressive disclosure, per the OKF spec). Links are
> standard markdown, relative to this file (`topic/article.md`), NEVER wikilinks.
>
> **Human navigation lives in the `.base` views** (`Articles.base`, `Worklog.base`,
> `Decisions.base`) — live tables over frontmatter, sorted by score/status/date.
> This index is the **machine-readable catalog + fallback** the agent maintains;
> it is not the primary surface a human browses in Obsidian.

## meta

Control plane del proyecto (lo que `CLAUDE.md`/`AGENTS.md` dicen sobre
arquitectura, stack y convenciones).

| Article | Summary | Updated | Score |
|---------|---------|---------|-------|
| [Control plane — Sistema del Sol](meta/control-plane.md) | Stack, multi-tenancy, RBAC, planes/módulos, facturación de plataforma, plugin system, convenciones, tests | 2026-11-24 | 6.0 |

## subprojects

Subproyectos y plugins del workspace — qué hace cada uno, qué está
entregado y qué queda pendiente.

| Article | Summary | Updated | Score |
|---------|---------|---------|-------|
| [Agente de Caja](subprojects/agente-caja.md) | App standalone que abre la gaveta de caja física del POS vía puerto COM | 2026-11-24 | 4.0 |
| [Automatización con n8n](subprojects/n8n-automatizacion.md) | Dos workflows verificados — alerta de stock bajo y reporte de ventas diario | 2026-11-24 | 4.0 |
| [Plugin Inmobiliaria](subprojects/plugin-inmobiliaria.md) | Catálogo de propiedades, 3 modelos de negocio entregados | 2026-11-24 | 8.0 |
| [Plugin Proyectos](subprojects/plugin-proyectos.md) | Hitos/tareas/horas/costos integrado al ERP | 2026-11-24 | 6.0 |
| [Plugin Tienda Online (e-commerce)](subprojects/plugin-ecommerce.md) | Módulo normal del backend, gateado por Plan/módulo | 2026-11-24 | 4.0 |
| [Plugin Publicaciones Sociales](subprojects/plugin-publicaciones-sociales.md) | Fábrica de contenido de marketing con aprobación humana obligatoria, 5 fases entregadas | 2026-11-24 | 6.0 |

## operations

Herramientas operativas por proveedor externo (`01-TOOLS/`).

| Article | Summary | Updated | Score |
|---------|---------|---------|-------|
| [01-TOOLS — resumen operativo](operations/01-tools-overview.md) | Catálogo de herramientas, filosofía, proveedores reales sin carpeta todavía | 2026-11-24 | 12.0 |
| [ANTHROPIC (operaciones)](operations/anthropic.md) | Claude API, degrada a heurística sin key | 2026-11-24 | 6.0 |
| [STRIPE (operaciones)](operations/stripe.md) | Pasarela de pago de la suscripción de plataforma | 2026-11-24 | 6.0 |
| [TWILIO (operaciones)](operations/twilio.md) | Mensajería de WhatsApp — notificaciones, bandeja, bot | 2026-11-24 | 8.0 |

## harness

El conocimiento propio del control plane sobre el usuario y sus
decisiones (reservado para la skill `harness`, preexistente al bootstrap
de hoy).

| Article | Summary | Updated | Score |
|---------|---------|---------|-------|
| [user-profile](harness/user-profile.md) | Perfil del usuario — registro técnico, objetivo del proyecto | (preexistente) | — |
| [decisions](harness/decisions.md) | Log append-only de decisiones (plan de onboarding aceptado, SDD seleccionado) | (preexistente) | — |
| [installation-plan](harness/installation-plan.md) | Plan de instalación de rsc aceptado — agentes/guards/capabilities seleccionados | (preexistente) | — |

## sdd

Constitución SDD del proyecto (no negociables), preexistente al bootstrap
de hoy.

| Article | Summary | Updated | Score |
|---------|---------|---------|-------|
| [constitution](sdd/constitution.md) | [DRAFT] Borrador sin ratificar — completar con la fase `constitution` antes del primer SDD | (preexistente) | — |

> **Score**: composite quality score (inbound links, source count, cited count,
> freshness; minus conflicts and orphan penalty). Regenerated on every
> Maintenance Pass. Articles below the rewrite threshold get picked up by
> Micro-Improve and Deep Improve.
