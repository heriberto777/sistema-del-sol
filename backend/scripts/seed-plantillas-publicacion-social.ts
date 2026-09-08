import { PrismaClient } from '@prisma/client';
import { PLANTILLAS_PUBLICACION_SOCIAL_BASE } from '../src/publicaciones-sociales/plantillas/plantillas-publicacion-social.base';

/**
 * Siembra el catálogo GLOBAL de plantillas del plugin Publicaciones
 * Sociales — mismo criterio que `seed-planes.ts` (Modulo/Plan): una
 * sola fuente de verdad en código (`PLANTILLAS_PUBLICACION_SOCIAL_BASE`),
 * sembrada una vez por entorno.
 *
 * Idempotente: `upsert` por `clave`, se puede correr de nuevo tras sumar
 * una plantilla nueva al catálogo en código.
 *
 * Uso: pnpm --filter ./backend plantillas-publicacion-social:seed
 */
async function main() {
  const prisma = new PrismaClient();

  for (const plantilla of PLANTILLAS_PUBLICACION_SOCIAL_BASE) {
    await prisma.plantillaPublicacionSocial.upsert({
      where: { clave: plantilla.clave },
      update: { nombre: plantilla.nombre },
      create: { clave: plantilla.clave, nombre: plantilla.nombre },
    });
  }

  console.log(`Listo: ${PLANTILLAS_PUBLICACION_SOCIAL_BASE.length} plantilla(s) sembrada(s).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
