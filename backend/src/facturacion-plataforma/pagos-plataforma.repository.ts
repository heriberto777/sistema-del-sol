import { Injectable } from '@nestjs/common';
import { MetodoPago } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { INCLUDE_PAGO_PLATAFORMA_BASICO } from '../common/prisma/pago-plataforma-select-basico';

@Injectable()
export class PagosPlataformaRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(params: {
    facturaId: string;
    monto: number;
    metodoPago: MetodoPago;
    referencia?: string;
    fecha: Date;
    // null = lo registró la pasarela de pago vía webhook, ningún admin de plataforma.
    registradoPorId: string | null;
  }) {
    return this.prisma.pagoPlataforma.create({ data: params });
  }

  /** Para el chequeo de idempotencia del webhook — Stripe reintenta el mismo evento si no recibe 200. */
  buscarPorFacturaYReferencia(facturaId: string, referencia: string) {
    return this.prisma.pagoPlataforma.findFirst({ where: { facturaId, referencia } });
  }

  listarPorFactura(facturaId: string) {
    return this.prisma.pagoPlataforma.findMany({
      where: { facturaId },
      include: INCLUDE_PAGO_PLATAFORMA_BASICO,
      orderBy: { fecha: 'desc' },
    });
  }

  async sumaPagosFactura(facturaId: string): Promise<number> {
    const { _sum } = await this.prisma.pagoPlataforma.aggregate({ where: { facturaId }, _sum: { monto: true } });
    return Number(_sum.monto ?? 0);
  }
}
