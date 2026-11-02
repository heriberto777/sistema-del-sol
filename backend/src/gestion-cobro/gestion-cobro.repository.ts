import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearGestionCobroDto } from './dto/crear-gestion-cobro.dto';

const INCLUDE_USUARIO = { user: { select: { nombre: true } } } as const;

@Injectable()
export class GestionCobroRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Toda acción de esta fase parte de una factura — resuelve su CuentaPorCobrar o 404 (CONTADO/factura inexistente nunca tienen una). */
  async buscarCuentaPorFacturaOrThrow(facturaId: string) {
    const cuenta = await this.db.cuentaPorCobrar.findUnique({ where: { facturaId } });
    if (!cuenta) {
      throw new NotFoundException('Esta factura no tiene una cuenta por cobrar asociada (solo aplica a ventas a crédito)');
    }
    return cuenta;
  }

  crearGestion(dto: CrearGestionCobroDto, tenantId: string, clienteId: string, cuentaPorCobrarId: string, userId: string) {
    return this.db.gestionCobro.create({
      data: {
        tenantId,
        clienteId,
        cuentaPorCobrarId,
        tipo: dto.tipo,
        resultado: dto.resultado,
        promesaFecha: dto.promesaFecha ? new Date(dto.promesaFecha) : undefined,
        promesaMonto: dto.promesaMonto,
        proximaAccion: dto.proximaAccion ? new Date(dto.proximaAccion) : undefined,
        userId,
      },
      include: INCLUDE_USUARIO,
    });
  }

  listarGestionesPorCuenta(cuentaPorCobrarId: string) {
    return this.db.gestionCobro.findMany({
      where: { cuentaPorCobrarId },
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_USUARIO,
    });
  }

  buscarProvisionPorCuenta(cuentaPorCobrarId: string) {
    return this.db.provisionIncobrable.findUnique({ where: { cuentaPorCobrarId } });
  }

  crearProvision(cuentaPorCobrarId: string, monto: number, motivo: string, tenantId: string, userId: string) {
    return this.db.provisionIncobrable.create({
      data: { tenantId, cuentaPorCobrarId, monto, motivo, userId },
    });
  }

  /** Castiga la provisión y cierra la CuentaPorCobrar en una sola transacción — ambas deben quedar consistentes o ninguna. */
  castigarEnTx(provisionId: string, cuentaPorCobrarId: string) {
    return this.db.$transaction(async (tx) => {
      const provision = await tx.provisionIncobrable.update({
        where: { id: provisionId },
        data: { estado: 'CASTIGADA', fechaCastigo: new Date() },
      });
      await tx.cuentaPorCobrar.update({ where: { id: cuentaPorCobrarId }, data: { estado: 'CASTIGADA' } });
      return provision;
    });
  }
}
