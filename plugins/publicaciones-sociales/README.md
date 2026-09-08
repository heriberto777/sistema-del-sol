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

## Fase 2 (entregada, superada por la Fase 3) — generación de fondo por IA

Un prompt de texto opcional manda la foto real del producto a Gemini
(`gemini-3-pro-image-preview`, proveedor activo por defecto) u OpenAI
(`gpt-image-1.5`, alternativa) — `backend/src/ia/generador-fondo/`,
mismo patrón multi-proveedor que `AnalizadorImagenService` pero para
generación (no vision); Claude no participa, no genera imágenes. Reusa
las API keys de OpenAI/Gemini ya guardadas en `/plataforma/configuración`
→ "IA para productos" (más su propio selector de proveedor/modelo,
porque la familia de modelos de generación es distinta a la de
vision/chat). Límite fijo de generaciones IA por tenant por mes
(`PlataformaConfiguracion.iaFondoLimiteMensual`, default 20, global) —
el costo por imagen lo paga la plataforma.

Originalmente (Fase 2 tal cual se entregó) la IA solo generaba el
FONDO y el Canvas de la Fase 1 dibujaba el precio encima — la Fase 3
cambió esa parte, ver abajo.

## Fase 3 (entregada) — la IA diseña la pieza completa, con datos reales

Bug real reportado con una captura: si el prompt le pedía a la IA su
propio texto de precio, la imagen terminaba con **dos precios
distintos superpuestos** (el inventado en el prompt y el real dibujado
por Canvas). Decisión del usuario: cuando se usa IA, la IA diseña la
pieza COMPLETA (precio, oferta/descuento si aplica, nombre) — nunca se
le vuelve a superponer Canvas encima.

- `construir-prompt-fondo-ia.ts`: arma el prompt con el precio
  formateado exacto y, si el producto tiene una oferta vigente, precio
  antes/después + % OFF o la mecánica de la promo (BOGO) — reusa
  `OfertasService.resolverOfertaVisibleProducto`, la MISMA lógica que
  ya usa la venta real (Facturación/POS), nunca un cálculo propio. El
  usuario nunca escribe el precio a mano en el prompt — solo describe
  ambientación/estilo.
- Los adapters de OpenAI/Gemini aceptan una segunda imagen de
  referencia opcional (el logo del tenant) para que la IA lo incluya
  nítido; salida forzada a cuadrado (1024×1024 / `aspectRatio: '1:1'`).
- El camino sin IA (plantillas fijas, Fase 1) no cambió — sigue
  dibujando con Canvas exactamente igual.
- **Mitigación del riesgo restante** (ninguna IA garantiza 100% que el
  texto salga perfecto): el detalle de cada publicación siempre muestra
  el precio/oferta REAL como texto al lado de la imagen, para que quien
  aprueba pueda comparar de un vistazo antes de aprobar — la aprobación
  humana sigue siendo la barrera real, igual que en la Fase 1.

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
- Elegir entre varias variantes de fondo por IA antes de guardar, y
  límite configurable por plan/tenant individual (hoy es un solo número
  global).
