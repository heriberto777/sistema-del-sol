import { BadRequestException, Injectable } from '@nestjs/common';
import { PagosPlataformaRepository } from './pagos-plataforma.repository';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { CrearPagoPlataformaDto } from './dto/crear-pago-plataforma.dto';

const EPSILON = 0.005; // tolerancia de redondeo en centavos, igual que PagosService de tenant

@Injectable()
export class PagosPlataformaService {
  constructor(
    private readonly pagosPlataformaRepository: PagosPlataformaRepository,
    private readonly facturasPlataformaRepository: FacturasPlataformaRepository,
    private readonly facturasPlataformaService: FacturasPlataformaService,
  ) {}

  async registrar(facturaId: string, dto: CrearPagoPlataformaDto, registradoPorId: string) {
    const factura = await this.facturasPlataformaRepository.buscarPorId(facturaId);
    if (factura.estado === 'PAGADA' || factura.estado === 'ANULADA') {
      throw new BadRequestException(`No se puede registrar un pago sobre una factura ${factura.estado.toLowerCase()}`);
    }

    const pagadoAntes = await this.pagosPlataformaRepository.sumaPagosFactura(facturaId);
    const total = Number(factura.total);
    const pendiente = total - pagadoAntes;
    if (dto.monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto excede el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const pago = await this.pagosPlataformaRepository.crear({
      facturaId,
      monto: dto.monto,
      metodoPago: dto.metodoPago,
      referencia: dto.referencia,
      fecha,
      registradoPorId,
    });

    if (pendiente - dto.monto <= EPSILON) {
      await this.facturasPlataformaService.marcarPagada(facturaId, fecha);
    }

    return pago;
  }

  async listarPorFactura(facturaId: string) {
    const [pagos, totalPagado] = await Promise.all([
      this.pagosPlataformaRepository.listarPorFactura(facturaId),
      this.pagosPlataformaRepository.sumaPagosFactura(facturaId),
    ]);
    return { pagos, totalPagado };
  }
}
