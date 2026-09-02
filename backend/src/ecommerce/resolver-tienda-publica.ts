import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolverConfigTienda } from './resolver-config-tienda';
import { moduloEstaActivo } from '../planes/resolver-modulos-activos';

/**
 * Resuelve tenant + config a partir del `:subdominio` de la URL — sin
 * JWT, así que ninguna de estas condiciones puede delegarse en
 * `ModuloActivoGuard` (que se auto-desactiva sin `request.user`, ver
 * modulo-activo.guard.ts). Un 404 parejo para tenant inexistente,
 * suspendido, sin el módulo "ecommerce" activo, o con la tienda
 * desactivada — no se distingue el motivo al público, igual que
 * cualquier otro recurso que no existe.
 *
 * Función pura (no un método de `EcommerceService`) a propósito —
 * `ClienteTiendaAuthService` (Fase 6, dominio de auth separado) también
 * necesita resolver la misma tienda antes de loguear/registrar, y esto
 * evita que ese módulo tenga que importar `EcommerceModule` entero (o
 * viceversa) solo para esta única función.
 */
export async function resolverTiendaPublica(prisma: PrismaService, subdominio: string) {
  const tenant = await prisma.tenant.findUnique({ where: { subdominio } });
  if (!tenant || tenant.estado !== 'ACTIVO') {
    throw new NotFoundException('Tienda no encontrada');
  }

  const moduloActivo = await moduloEstaActivo(prisma, tenant.id, 'ecommerce');
  if (!moduloActivo) {
    throw new NotFoundException('Tienda no encontrada');
  }

  const config = await resolverConfigTienda(prisma, tenant.id);
  if (!config.activa) {
    throw new NotFoundException('Tienda no encontrada');
  }

  return { tenant, config };
}
