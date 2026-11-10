import { Injectable } from '@nestjs/common';
import { CategoriasProveedorRepository } from './categorias-proveedor.repository';
import { CrearCategoriaProveedorDto } from './dto/crear-categoria-proveedor.dto';

@Injectable()
export class CategoriasProveedorService {
  constructor(private readonly categoriasProveedorRepository: CategoriasProveedorRepository) {}

  crear(dto: CrearCategoriaProveedorDto, tenantId: string) {
    return this.categoriasProveedorRepository.crear(dto, tenantId);
  }

  listar(soloActivas: boolean) {
    return this.categoriasProveedorRepository.listar(soloActivas);
  }

  buscarPorId(id: string) {
    return this.categoriasProveedorRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearCategoriaProveedorDto>) {
    return this.categoriasProveedorRepository.actualizar(id, dto);
  }
}
