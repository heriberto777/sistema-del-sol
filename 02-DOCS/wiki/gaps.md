# Knowledge Gaps

Append-only log of wanted-but-missing topics. Entries are flagged
`[FILLED YYYY-MM-DD]` when an Improve pass writes the article — never
deleted. Compaction (Deep Improve only) removes `[FILLED]` entries older
than 90 days, with a single compaction marker entry in `wiki/log.md`.

One entry per gap, in this shape:

```markdown
## [YYYY-MM-DD] gap | {concept}

Source: {where this gap was detected}

Mentioned in: [Article A](topic/a.md); [Article B](topic/b.md)

Suggested topic: {topic where the new article would belong}

Status: open
```

## [2026-11-24] gap | docs/ — documentación técnica preexistente del proyecto

Source: audit `02-DOCS/audits/audit-2026-11-24-1229.html` (bootstrap de
`harness`). La carpeta `docs/` del proyecto (12 archivos, ~12.891
líneas — `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `SISTEMA.md`,
`GUIA_PLUGINS.md`, `PLAN.md`, `DEVELOPMENT.md`, `DEPLOYMENT.md`,
`Sistema_del_Sol_Travel_Management_Plugin.md`, `cuadre-auditoria.md`,
`cuadre-plan-integracion.md`, `cxc-cxp-nomina-plan.md`,
`estructura_arquitectonica.md`) no se barrió en este bootstrap a
propósito — está referenciada directo desde `CLAUDE.md` como fuente
canónica para desarrolladores, así que amerita una invocación explícita
("procesa docs/") en modo copia (nunca proponer borrar la carpeta
después), no el flujo por defecto del Auto-Ingest Sweep que sí ofrece
eliminar la carpeta de origen.

Mentioned in: (ninguno todavía — no hay artículos de wiki sobre
arquitectura/multi-tenancy/RBAC/contabilidad/nómina hasta que se corra
ese barrido)

Suggested topic: `architecture/`, `database/`, `operations/` (a decidir
al compilar, probablemente un topic por módulo grande: `multi-tenancy`,
`rbac`, `contabilidad`, `facturacion-plataforma`, etc.)

Status: open

## [2026-11-24] gap | pantallas/ y n8n/workflows/*.json — ambiguos, sin tocar

Source: audit `02-DOCS/audits/audit-2026-11-24-1229.html`. `pantallas/`
(solo capturas PNG de UI, sin README ni contexto de qué documentan o si
siguen vigentes) y `n8n/workflows/*.json` (exports de flujos n8n —
formato documental mas contenido operativo, no prosa) quedaron listados
como AMBIGUOUS en el audit — no se movieron ni se ingirieron.

Mentioned in: (ninguno)

Suggested topic: a decidir con el usuario (¿`pantallas/` sigue
documentando el estado actual de la UI, o son capturas viejas a
descartar? ¿los workflows de n8n ameritan un artículo de
`operations/automatizacion/`?)

Status: open
