import { PrismaClient } from '@prisma/client';
import { PLANTILLAS_PUBLICACIONES_SOCIALES_BASE } from '../src/notificaciones/plantillas-publicaciones-sociales-base';

/**
 * Fase 5 (Publicaciones Sociales) — agrega a los tenants YA existentes
 * las `NotificacionPlantilla` por defecto del aviso de aprobación/pedido
 * de cambios. `TenantsRepository.crearConProvisioning` solo las siembra
 * al crear un tenant NUEVO (mismo criterio que `permisos:backfill`, ver
 * `scripts/backfill-permisos.ts`) — sin este script, un tenant creado
 * ANTES de esta feature nunca recibiría el aviso (el email queda como
 * no-op silencioso hasta que un admin cree la plantilla a mano).
 *
 * Idempotente (upsert por tenantId+canal+clave): no pisa una plantilla
 * que el tenant ya haya personalizado — solo crea la que falte.
 *
 * Uso: pnpm --filter ./backend notificaciones:plantillas-publicaciones-sociales:backfill
 */
async function main() {
  const prisma = new PrismaClient();

  const tenants = await prisma.tenant.findMany({ select: { id: true, nombre: true } });
  let totalCreadas = 0;

  for (const tenant of tenants) {
    for (const plantilla of PLANTILLAS_PUBLICACIONES_SOCIALES_BASE) {
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
