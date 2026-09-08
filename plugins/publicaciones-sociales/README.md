# Plugin: Publicaciones Sociales

Fábrica de contenido de marketing a partir del catálogo de productos —
**nunca publica directo en ninguna red social**: eso exigiría OAuth por
tenant + revisión de app de Meta + auditoría de TikTok, un trámite
externo que puede tardar semanas y no depende de nosotros (ver
investigación previa a esta Fase 1). En cambio, genera un diseño, un
responsable lo aprueba o rechaza dentro de la plataforma, y una vez
aprobado el tenant se lo lleva por **descarga** o por **WhatsApp**
(botones manuales, nunca envío automático) — el tenant lo publica él
mismo donde quiera.

**Implementación real**: `backend/src/publicaciones-sociales/` (mismo
criterio que `proyectos`/`ecommerce` — este directorio es solo el
manifiesto que lee `PluginLoaderService` al boot, no el código).

## Fase 1 (entregada) — solo imagen

- Modelo de datos: `PlantillaPublicacionSocial` (catálogo global de
  layouts) → `PublicacionSocial` (una fila por diseño generado, estado
  `BORRADOR → PENDIENTE_APROBACION → APROBADA|RECHAZADA`).
- Generación server-side con `@napi-rs/canvas` (banner 1080×1080, foto
  real del producto + nombre + precio + logo del tenant si está
  configurado) — 3 plantillas: `precio-destacado`, `minimalista`,
  `oferta`. Fuente embebida (Inter, `backend/assets/fonts/`) para no
  depender de fuentes del sistema operativo en el contenedor de
  producción.
- Aprobación dentro de la plataforma: rechazar exige un motivo.
- Entrega solo tras `APROBADA`: descarga del PNG, o envío por WhatsApp
  (reusa la infraestructura de Twilio ya existente) — ambos son
  acciones manuales, nunca automáticas.
- Permisos opt-in: `publicacionessociales.ver` / `.crear` / `.editar` /
  `.aprobar` — Admin Total/Gerente los heredan automático, cualquier
  otro rol necesita que se lo asignen a mano desde Roles y Permisos.
- Activación por tenant: clave `publicacionessociales` en
  `MODULOS_BASE` — vía Plan o `TenantModuloOverride`, nunca la activa
  el propio tenant.

## Fases futuras (no implementadas, a propósito no se dejó nada a medio camino)

- **Video** (reels/shorts): plantillas animadas (Remotion) y generación
  por IA (clips cortos concatenados, ej. Runway) — necesita una cola de
  trabajos en segundo plano (BullMQ sobre el Redis ya desplegado, hoy
  el proyecto solo tiene crons de intervalo fijo, nada on-demand).
- Aprobación vía WhatsApp con botones nativos (Content API de Twilio +
  plantilla de mensaje aprobada por Meta) — hoy la aprobación es
  siempre dentro de la plataforma.
- Publicación directa en alguna red — fuera de alcance a propósito,
  ver el análisis de factibilidad previo a esta fase.
