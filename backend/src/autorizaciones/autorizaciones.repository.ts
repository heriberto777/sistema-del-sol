import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TipoCodigoAutorizacion } from '@prisma/client';

export interface DestinatarioAutorizacion {
  id: string;
  nombre: string;
  email: string;
}

@Injectable()
export class AutorizacionesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * Encargados de la sucursal con `pos.supervisar` primero; si no hay
   * ninguno asignado (o la operación no tiene sucursal resoluble), cae a
   * todos los `Admin Total` del tenant — mismo criterio de "fallback al
   * administrador" que el resto del proyecto (ver
   * FacturasPlataformaCronService, notifica al Admin Total más antiguo).
   */
  async resolverDestinatarios(sucursalId: string | null): Promise<DestinatarioAutorizacion[]> {
    if (sucursalId) {
      const encargados = await this.db.user.findMany({
        where: {
          activo: true,
          sucursales: { some: { sucursalId } },
          roles: { some: { role: { rolePermissions: { some: { permission: { clave: 'pos.supervisar' } } } } } },
        },
        select: { id: true, nombre: true, email: true },
      });
      if (encargados.length > 0) return encargados;
    }
    return this.db.user.findMany({
      where: { activo: true, roles: { some: { role: { nombre: 'Admin Total' } } } },
      select: { id: true, nombre: true, email: true },
    });
  }

  /** Un pedido nuevo invalida cualquier código pendiente anterior del mismo tipo+referencia — evita confusión de cuál código vale. */
  invalidarPendientes(tipo: TipoCodigoAutorizacion, referenciaId: string) {
    return this.db.codigoAutorizacion.deleteMany({ where: { tipo, referenciaId, usadoEn: null } });
  }

  crear(params: {
    tenantId: string;
    tipo: TipoCodigoAutorizacion;
    referenciaId: string;
    codigoHash: string;
    expiraEn: Date;
    solicitadoPorId: string;
  }) {
    return this.db.codigoAutorizacion.create({ data: params });
  }

  buscarPendiente(tipo: TipoCodigoAutorizacion, referenciaId: string) {
    return this.db.codigoAutorizacion.findFirst({
      where: { tipo, referenciaId, usadoEn: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  registrarIntentoFallido(id: string, intentosFallidos: number) {
    return this.db.codigoAutorizacion.update({ where: { id }, data: { intentosFallidos } });
  }

  marcarUsado(id: string) {
    return this.db.codigoAutorizacion.update({ where: { id }, data: { usadoEn: new Date() } });
  }
}
