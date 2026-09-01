import { Injectable } from '@nestjs/common';
import { Prisma, TipoNcf } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NcfPlataformaRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.ncfPlataforma.findMany({ orderBy: [{ tipoNcf: 'asc' }] });
  }

  /** A lo sumo una activa por tipo — se valida en NcfPlataformaService.crear. */
  buscarActiva(tipoNcf: TipoNcf) {
    return this.prisma.ncfPlataforma.findFirst({ where: { tipoNcf, activo: true } });
  }

  buscarPorId(id: string) {
    return this.prisma.ncfPlataforma.findUniqueOrThrow({ where: { id } });
  }

  crear(params: { tipoNcf: TipoNcf; secuenciaInicial: number; secuenciaFinal: number; vigenciaHasta: Date; umbralAlerta?: number }) {
    return this.prisma.ncfPlataforma.create({
      data: {
        tipoNcf: params.tipoNcf,
        secuenciaActual: params.secuenciaInicial,
        secuenciaFinal: params.secuenciaFinal,
        vigenciaHasta: params.vigenciaHasta,
        umbralAlerta: params.umbralAlerta,
      },
    });
  }

  actualizar(id: string, data: { secuenciaFinal?: number; vigenciaHasta?: Date; activo?: boolean; umbralAlerta?: number | null }) {
    return this.prisma.ncfPlataforma.update({ where: { id }, data });
  }

  /**
   * Cuerpo idéntico a FacturacionRepository.siguienteNcfEnTx (lado
   * tenant) sin la rama de sucursal — ver ARCHITECTURE.md para el
   * criterio de atomicidad de `{ increment: 1 }`.
   */
  async siguienteEnTx(tx: Prisma.TransactionClient, tipoNcf: TipoNcf): Promise<{ ncf: string; tipoNcf: TipoNcf }> {
    const secuencia = await tx.ncfPlataforma.findFirstOrThrow({ where: { tipoNcf, activo: true } });
    const actualizada = await tx.ncfPlataforma.update({
      where: { id: secuencia.id },
      data: { secuenciaActual: { increment: 1 } },
    });
    if (actualizada.secuenciaActual - 1 > actualizada.secuenciaFinal) {
      throw new Error(`Secuencia de NCF de plataforma ${tipoNcf} agotada`);
    }
    return { ncf: `${tipoNcf}${String(actualizada.secuenciaActual - 1).padStart(8, '0')}`, tipoNcf };
  }
}
