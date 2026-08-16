import { Injectable } from '@nestjs/common';
import { TipoNcf } from '@prisma/client';
import { NcfRepository } from './ncf.repository';
import { CrearNcfDto } from './dto/crear-ncf.dto';
import { ActualizarNcfDto } from './dto/actualizar-ncf.dto';

@Injectable()
export class NcfService {
  constructor(private readonly ncfRepository: NcfRepository) {}

  listar() {
    return this.ncfRepository.listar();
  }

  crear(dto: CrearNcfDto, tenantId: string) {
    return this.ncfRepository.crear({
      tenantId,
      tipoNcf: dto.tipoNcf,
      secuenciaInicial: dto.secuenciaInicial ?? 1,
      secuenciaFinal: dto.secuenciaFinal,
      vigenciaHasta: new Date(dto.vigenciaHasta),
    });
  }

  actualizar(tipoNcf: TipoNcf, dto: ActualizarNcfDto, tenantId: string) {
    return this.ncfRepository.actualizar(tenantId, tipoNcf, {
      secuenciaFinal: dto.secuenciaFinal,
      vigenciaHasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : undefined,
      activo: dto.activo,
    });
  }
}
