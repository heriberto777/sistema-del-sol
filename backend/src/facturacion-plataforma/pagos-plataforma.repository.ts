import { Injectable } from '@nestjs/common';
import { MetodoPago } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  listarPorFactura(facturaId: string) {
    return this.prisma.pagoPlataforma.findMany({
      where: { facturaId },
      include: { registradoPor: { select: { nombre: true } } },
      orderBy: { fecha: 'desc' },
    });
  }

  async sumaPagosFactura(facturaId: string): Promise<number> {
    const { _sum } = await this.prisma.pagoPlataforma.aggregate({ where: { facturaId }, _sum: { monto: true } });
    return Number(_sum.monto ?? 0);
  }
}
