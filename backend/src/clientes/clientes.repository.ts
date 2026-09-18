import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { CLIENTE_SELECT_COMPLETO } from '../common/prisma/cliente-select-basico';

@Injectable()
export class ClientesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearClienteDto, tenantId: string) {
    return this.db.cliente.create({ data: { ...dto, tenantId }, select: CLIENTE_SELECT_COMPLETO });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = {
      activo: true,
      ...(params.busqueda
        ? {
            OR: [
              { nombre: { contains: params.busqueda, mode: 'insensitive' as const } },
              { email: { contains: params.busqueda, mode: 'insensitive' as const } },
              { rncCedula: { contains: params.busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this.db.cliente.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: params.skip,
        take: params.take,
        select: CLIENTE_SELECT_COMPLETO,
      }),
      this.db.cliente.count({ where }),
    ]);
  }

  buscarPorId(id: string) {
    return this.db.cliente.findUniqueOrThrow({
      where: { id },
      select: { ...CLIENTE_SELECT_COMPLETO, direcciones: true },
    });
  }

  /** Sembrado al provisionar el tenant (ver TenantsRepository.crearConProvisioning) — nunca debería faltar, pero null en vez de throw por si un tenant viejo no fue backfilleado todavía. */
  buscarConsumidorFinal() {
    return this.db.cliente.findFirst({
      where: { esConsumidorFinal: true },
      select: CLIENTE_SELECT_COMPLETO,
    });
  }

  actualizar(id: string, dto: Partial<CrearClienteDto>) {
    return this.db.cliente.update({ where: { id }, data: dto, select: CLIENTE_SELECT_COMPLETO });
  }

  /**
   * Estado de cuenta — mismo universo que Cuentas por Cobrar
   * (`estado: 'EMITIDA'`, excluye BORRADOR/ANULADA) pero para TODOS los
   * tipos de factura de un cliente puntual, no solo CRÉDITO pendiente:
   * el signo de `total` ya viene invertido en NOTA_CREDITO (ver
   * FacturacionService.crear, `signo = -1`), así que sumar `total` tal
   * cual ya neta correctamente sin lógica aparte acá.
   */
  buscarFacturasParaEstadoCuenta(clienteId: string, desde?: Date, hasta?: Date) {
    return this.db.factura.findMany({
      where: {
        clienteId,
        estado: 'EMITIDA',
        ...(desde || hasta ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
      },
      orderBy: { fecha: 'asc' },
      select: { id: true, numero: true, ncf: true, tipoFactura: true, fecha: true, total: true, pagada: true },
    });
  }

  /** Pagos parciales ya registrados contra cada factura — mismo patrón que CuentasPorCobrarRepository.sumaPagosPorFacturas. */
  sumaPagosPorFacturas(facturaIds: string[]) {
    if (!facturaIds.length) return Promise.resolve([]);
    return this.db.pago.groupBy({ by: ['facturaId'], where: { facturaId: { in: facturaIds } }, _sum: { monto: true } });
  }
}
