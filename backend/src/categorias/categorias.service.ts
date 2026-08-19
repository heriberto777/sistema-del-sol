import { BadRequestException, Injectable } from '@nestjs/common';
import { CategoriasRepository } from './categorias.repository';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly categoriasRepository: CategoriasRepository) {}

  async crear(dto: CrearCategoriaDto, tenantId: string) {
    // findUniqueOrThrow tenant-scoped: si categoriaPadreId es de otro tenant, 404 —
    // mismo patrón de prevención de IDOR ya documentado para FKs cliente-suministradas.
    if (dto.categoriaPadreId) {
      await this.categoriasRepository.buscarPorId(dto.categoriaPadreId);
    }
    return this.categoriasRepository.crear(dto, tenantId);
  }

  listar() {
    return this.categoriasRepository.listar();
  }

  async actualizar(id: string, dto: Partial<CrearCategoriaDto>) {
    if (dto.categoriaPadreId) {
      if (dto.categoriaPadreId === id) {
        throw new BadRequestException('Una categoría no puede ser su propia categoría padre');
      }
      await this.validarNoEsDescendiente(id, dto.categoriaPadreId);
    }
    return this.categoriasRepository.actualizar(id, dto);
  }

  async eliminar(id: string) {
    const categoria = await this.categoriasRepository.buscarPorId(id);
    if (categoria._count.productos > 0) {
      throw new BadRequestException('No se puede eliminar: hay productos asignados a esta categoría');
    }
    if (categoria._count.subcategorias > 0) {
      throw new BadRequestException('No se puede eliminar: tiene subcategorías — moverlas o eliminarlas primero');
    }
    return this.categoriasRepository.eliminar(id);
  }

  /** Recorre la cadena de categoriaPadreId hacia arriba desde `candidatoPadreId` — si llega a `id`, asignarlo crearía un ciclo. */
  private async validarNoEsDescendiente(id: string, candidatoPadreId: string) {
    let actualId: string | null = candidatoPadreId;
    while (actualId) {
      const categoria = await this.categoriasRepository.buscarPorId(actualId);
      if (categoria.id === id) {
        throw new BadRequestException('No se puede asignar una subcategoría como categoría padre — crearía un ciclo');
      }
      actualId = categoria.categoriaPadreId;
    }
  }
}
