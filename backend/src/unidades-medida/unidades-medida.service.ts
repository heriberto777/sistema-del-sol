import { Injectable } from '@nestjs/common';
import { UnidadesMedidaRepository } from './unidades-medida.repository';
import { CrearUnidadMedidaDto } from './dto/crear-unidad-medida.dto';

@Injectable()
export class UnidadesMedidaService {
  constructor(private readonly unidadesMedidaRepository: UnidadesMedidaRepository) {}

  crear(dto: CrearUnidadMedidaDto, tenantId: string) {
    return this.unidadesMedidaRepository.crear(dto, tenantId);
  }

  listar(soloActivas: boolean) {
    return this.unidadesMedidaRepository.listar(soloActivas);
  }

  buscarPorId(id: string) {
    return this.unidadesMedidaRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearUnidadMedidaDto>) {
    return this.unidadesMedidaRepository.actualizar(id, dto);
  }
}
