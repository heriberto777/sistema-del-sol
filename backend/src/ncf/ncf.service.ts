import { ConflictException, Injectable } from '@nestjs/common';
import { ModalidadFacturacion } from '@prisma/client';
import { NcfRepository } from './ncf.repository';
import { SucursalesRepository } from '../sucursales/sucursales.repository';
import { CrearNcfDto } from './dto/crear-ncf.dto';
import { ActualizarNcfDto } from './dto/actualizar-ncf.dto';

@Injectable()
export class NcfService {
  constructor(
    private readonly ncfRepository: NcfRepository,
    private readonly sucursalesRepository: SucursalesRepository,
  ) {}

  obtenerModalidad(tenantId: string) {
    return this.ncfRepository.obtenerModalidad(tenantId);
  }

  actualizarModalidad(tenantId: string, modalidad: ModalidadFacturacion) {
    return this.ncfRepository.actualizarModalidad(tenantId, modalidad);
  }

  listar() {
    return this.ncfRepository.listar();
  }

  async crear(dto: CrearNcfDto, tenantId: string) {
    if (dto.sucursalId) {
      // 404 si la sucursal no pertenece al tenant — mismo patrón IDOR-safe
      // que el resto de las FKs suministradas por el cliente.
      await this.sucursalesRepository.buscarPorId(dto.sucursalId);
    } else {
      // A lo sumo una fila COMPARTIDA (sucursalId: null) por tipo — ver
      // comentario en schema.prisma sobre por qué esto es código y no un
      // índice único (Postgres no deduplica NULLs).
      const existente = await this.ncfRepository.buscarActivaGlobal(tenantId, dto.tipoNcf);
      if (existente) {
        throw new ConflictException(`Ya existe una secuencia compartida de ${dto.tipoNcf} — asigná una sucursal específica o editá la existente`);
      }
    }

    return this.ncfRepository.crear({
      tenantId,
      tipoNcf: dto.tipoNcf,
      sucursalId: dto.sucursalId,
      secuenciaInicial: dto.secuenciaInicial ?? 1,
      secuenciaFinal: dto.secuenciaFinal,
      vigenciaHasta: new Date(dto.vigenciaHasta),
      umbralAlerta: dto.umbralAlerta,
    });
  }

  actualizar(id: string, dto: ActualizarNcfDto) {
    return this.ncfRepository.actualizar(id, {
      secuenciaFinal: dto.secuenciaFinal,
      vigenciaHasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : undefined,
      activo: dto.activo,
      umbralAlerta: dto.umbralAlerta,
    });
  }
}
