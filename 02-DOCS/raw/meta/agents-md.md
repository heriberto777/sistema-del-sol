# AGENTS.md (raíz del proyecto)

> Source: `AGENTS.md`
> Collected: 2026-11-24
> Published: Unknown (creado en este mismo bootstrap de `harness`)

# AGENTS.md — Sistema del Sol

> Generado por `harness` el 2026-11-24.
> Para agentes distintos de Claude Code (Codex, Cursor, Aider, etc.), este
> archivo es la primera lectura. Para Claude Code, ver `CLAUDE.md` (ambos
> archivos están alineados; `CLAUDE.md` tiene además el detalle completo
> de arquitectura del proyecto).

## Workspace

Un único repo Git en la raíz. Workspace pnpm con `backend`, `frontend` y
`plugins/*` como paquetes del mismo monorepo — no son repos
independientes, no asumir multi-repo.

## Mapa rápido

| Ruta | Rol |
|------|-----|
| `backend/` | NestJS + Prisma + PostgreSQL — API, multi-tenancy, RBAC, contabilidad, nómina, POS |
| `frontend/` | React + Vite + TailwindCSS — SPA del admin y de la tienda online |
| `plugins/*` | Módulos activables por tenant (inmobiliaria, proyectos, ecommerce, publicaciones-sociales) — mismo proceso compilado, importados a mano en `backend/src/app.module.ts` |
| `agente-caja/` | App Node standalone (empaquetada a `.exe`), abre la gaveta de caja del POS |
| `n8n/` | Flujos de automatización |
| `01-TOOLS/` | Herramientas operativas por proveedor externo |
| `02-DOCS/` | Wiki LLM (`raw/` + `wiki/` + `index.md` + `log.md`) |
| `docs/` | Documentación técnica del proyecto para desarrolladores |

## Reglas mínimas

1. Antes de editar: `git status --short` en la raíz.
2. No commitear sin avisar.
3. No tocar `01-TOOLS/**/.env`, `backend/.env`, `frontend/.env`.
4. No tocar outputs generados: `node_modules/`, `dist/`, `build/`.
5. Para sumar una herramienta externa nueva, usar `01-TOOLS/_TEMPLATE/`.
6. Para documentación reusable, escribir en `02-DOCS/raw/<tema>/` y
   compilar en `02-DOCS/wiki/<tema>/`.
7. Cambios a `schema.prisma` o que generan una migración: avisar
   siempre y explícitamente antes de aplicarlos.
8. Multi-tenancy real: cualquier endpoint nuevo que reciba un id de una
   tabla "hija" sin `tenantId` propio debe validar primero que el padre
   pertenece al tenant.

## Comandos principales

Ver `CLAUDE.md` → sección "Comandos".

## Diferencias con `CLAUDE.md`

Ninguna por ahora. Ambos archivos cubren las mismas reglas; `CLAUDE.md`
tiene además el detalle completo de arquitectura.
