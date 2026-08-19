import { BadRequestException, Injectable } from '@nestjs/common';
import { ListasPrecioRepository } from './listas-precio.repository';
import { CrearListaPrecioDto } from './dto/crear-lista-precio.dto';

@Injectable()
export class ListasPrecioService {
  constructor(private readonly listasPrecioRepository: ListasPrecioRepository) {}

  crear(dto: CrearListaPrecioDto, tenantId: string) {
    return this.listasPrecioRepository.crear(dto, tenantId);
  }

  listar(soloActivas: boolean) {
    return this.listasPrecioRepository.listar(soloActivas);
  }

  buscarPorId(id: string) {
    return this.listasPrecioRepository.buscarPorId(id);
  }

  /**
   * "GENERAL" es el default histórico de `Precio.listaPrecio` (schema) y
   * el fallback hardcodeado en varios services — renombrarla dejaría esos
   * precios inalcanzables desde el catálogo sin que ningún dato se pierda
   * (silencioso). Se puede desactivar, pero no renombrar.
   */
  async actualizar(id: string, dto: Partial<CrearListaPrecioDto>) {
    if (dto.nombre !== undefined) {
      const actual = await this.listasPrecioRepository.buscarPorId(id);
      if (actual.nombre === 'GENERAL' && dto.nombre !== 'GENERAL') {
        throw new BadRequestException('No se puede renombrar la lista "GENERAL" — es el nivel de precio por defecto del sistema');
      }
    }
    return this.listasPrecioRepository.actualizar(id, dto);
  }
}
