import { Injectable } from '@nestjs/common';
import { BancosRepository } from './bancos.repository';
import { CrearCuentaBancariaDto } from './dto/crear-cuenta-bancaria.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class BancosService {
  constructor(private readonly bancosRepository: BancosRepository) {}

  crear(dto: CrearCuentaBancariaDto, tenantId: string) {
    return this.bancosRepository.crear(dto, tenantId);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.bancosRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.bancosRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearCuentaBancariaDto>) {
    return this.bancosRepository.actualizar(id, dto);
  }
}
