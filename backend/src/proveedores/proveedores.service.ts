import { Injectable } from '@nestjs/common';
import { ProveedoresRepository } from './proveedores.repository';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class ProveedoresService {
  constructor(private readonly proveedoresRepository: ProveedoresRepository) {}

  crear(dto: CrearProveedorDto, tenantId: string) {
    return this.proveedoresRepository.crear(dto, tenantId);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.proveedoresRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.proveedoresRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearProveedorDto>) {
    return this.proveedoresRepository.actualizar(id, dto);
  }
}
