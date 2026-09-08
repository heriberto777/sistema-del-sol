/**
 * Catálogo GLOBAL de plantillas de banner (Plugin Publicaciones
 * Sociales, Fase 1) — mismo criterio que MODULOS_BASE/PLANES_BASE
 * (`backend/src/tenants/modulos-base.ts`): una sola fuente de verdad en
 * código, sembrada a la base con `scripts/seed-plantillas-publicacion-social.ts`
 * (idempotente, se puede correr de nuevo tras editar este catálogo).
 *
 * El layout real de cada plantilla (qué dibuja, dónde) vive en su propio
 * archivo bajo este mismo directorio — ver `./index.ts`.
 */
export const PLANTILLAS_PUBLICACION_SOCIAL_BASE: { clave: string; nombre: string }[] = [
  { clave: 'precio-destacado', nombre: 'Precio Destacado' },
  { clave: 'minimalista', nombre: 'Minimalista' },
  { clave: 'oferta', nombre: 'Oferta' },
];
