import { Injectable } from '@nestjs/common';
import { MetasVentaRepository } from './metas-venta.repository';
import { CrearMetaVentaDto } from './dto/crear-meta-venta.dto';

function rangoDelMes(anio: number, mes: number) {
  return { desde: new Date(anio, mes - 1, 1), hasta: new Date(anio, mes, 0, 23, 59, 59, 999) };
}

@Injectable()
export class MetasVentaService {
  constructor(private readonly metasVentaRepository: MetasVentaRepository) {}

  listarVendedoresPosibles() {
    return this.metasVentaRepository.listarVendedoresPosibles();
  }

  async crear(dto: CrearMetaVentaDto, tenantId: string) {
    await this.metasVentaRepository.validarVendedorDelTenant(dto.vendedorId);
    return this.metasVentaRepository.upsert(dto, tenantId);
  }

  /** Progreso real (monto ganado en Oportunidades ese mes) vs. la meta — no solo el CRUD del número. */
  async listarPorPeriodo(anio: number, mes: number) {
    const metas = await this.metasVentaRepository.listarPorPeriodo(anio, mes);
    const { desde, hasta } = rangoDelMes(anio, mes);

    return Promise.all(
      metas.map(async (meta) => {
        const montoReal = await this.metasVentaRepository.montoGanadoPorVendedor(meta.vendedorId, desde, hasta);
        const montoMeta = Number(meta.montoMeta);
        return {
          id: meta.id,
          vendedorId: meta.vendedorId,
          nombre: meta.vendedor.nombre,
          anio: meta.anio,
          mes: meta.mes,
          montoMeta,
          montoReal,
          porcentajeCumplido: montoMeta > 0 ? montoReal / montoMeta : 0,
        };
      }),
    );
  }

  async eliminar(id: string) {
    await this.metasVentaRepository.buscarPorId(id);
    await this.metasVentaRepository.eliminar(id);
  }
}
