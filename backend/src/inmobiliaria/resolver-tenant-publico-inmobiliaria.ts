import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { moduloEstaActivo } from '../planes/resolver-modulos-activos';

/**
 * Resuelve tenant a partir del `:subdominio` de la URL para el catálogo
 * PÚBLICO de propiedades — sin JWT, mismo criterio que
 * `resolverTiendaPublica` (ecommerce): 404 parejo para tenant inexistente,
 * suspendido o sin el módulo "inmobiliaria" activo, sin distinguir el
 * motivo al público.
 */
export async function resolverTenantPublicoInmobiliaria(prisma: PrismaService, subdominio: string) {
  const tenant = await prisma.tenant.findUnique({ where: { subdominio } });
  if (!tenant || tenant.estado !== 'ACTIVO') {
    throw new NotFoundException('Catálogo no encontrado');
  }

  const moduloActivo = await moduloEstaActivo(prisma, tenant.id, 'inmobiliaria');
  if (!moduloActivo) {
    throw new NotFoundException('Catálogo no encontrado');
  }

  return tenant;
}
