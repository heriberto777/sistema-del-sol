import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearFormaPagoDto } from './dto/crear-forma-pago.dto';

@Injectable()
export class FormasPagoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearFormaPagoDto, tenantId: string) {
    return this.db.formaPago.create({ data: { ...dto, tenantId } });
  }

  listar(soloActivas: boolean) {
    return this.db.formaPago.findMany({
      where: soloActivas ? { activa: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }

  buscarPorId(id: string) {
    return this.db.formaPago.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearFormaPagoDto>) {
    return this.db.formaPago.update({ where: { id }, data: dto });
  }

  /** Como mucho una FormaPago por tenant debería contar como efectivo físico para el arqueo — ver PosRepository.calcularMovimientoEfectivo. */
  desmarcarEfectivoDeOtras(tenantId: string, exceptoId?: string) {
    return this.db.formaPago.updateMany({
      where: { tenantId, esEfectivo: true, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
      data: { esEfectivo: false },
    });
  }
}
