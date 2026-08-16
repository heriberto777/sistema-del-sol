import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductosRepository } from './productos.repository';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class ProductosService {
  constructor(private readonly productosRepository: ProductosRepository) {}

  crear(dto: CrearProductoDto, tenantId: string) {
    return this.productosRepository.crear(dto, tenantId);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.productosRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.productosRepository.buscarPorId(id);
  }

  buscarPorIdEnTx(tx: Prisma.TransactionClient, id: string) {
    return this.productosRepository.buscarPorIdEnTx(tx, id);
  }

  actualizar(id: string, dto: Partial<CrearProductoDto>) {
    return this.productosRepository.actualizar(id, dto);
  }
}
