import { PrismaClient } from '@prisma/client';
import { PLANTILLAS_COMENTARIOS_TAREA_BASE } from '../src/notificaciones/plantillas-comentarios-tarea-base';

/**
 * Fase 8 (Comentarios de tarea) — agrega a los tenants YA existentes las
 * `NotificacionPlantilla` por defecto del aviso de "nuevo comentario".
 * `TenantsRepository.crearConProvisioning` solo las siembra al crear un
 * tenant NUEVO — mismo criterio que
 * `notificaciones:plantillas-publicaciones-sociales:backfill`.
 *
 * Idempotente (upsert por tenantId+canal+clave): no pisa una plantilla
 * que el tenant ya haya personalizado — solo crea la que falte.
 *
 * Uso: pnpm --filter ./backend notificaciones:plantillas-comentarios-tarea:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalCreadas = 0;

  for (const tenant of tenants) {
    for (const plantilla of PLANTILLAS_COMENTARIOS_TAREA_BASE) {
      const existente = await prisma.notificacionPlantilla.findUnique({
        where: { tenantId_canal_clave: { tenantId: tenant.id, canal: plantilla.canal, clave: plantilla.clave } },
      });
      if (existente) continue;

      await prisma.notificacionPlantilla.create({ data: { tenantId: tenant.id, ...plantilla } });
      totalCreadas += 1;
      console.log(`${tenant.nombre}: + plantilla "${plantilla.clave}" (${plantilla.canal})`);
    }
  }

  console.log(totalCreadas > 0 ? `Listo: ${totalCreadas} plantilla(s) creada(s) en total.` : 'Nada que agregar — todos los tenants ya las tienen.');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
