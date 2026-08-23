import { Injectable } from '@nestjs/common';
import { CategoriasClienteRepository } from './categorias-cliente.repository';
import { CrearCategoriaClienteDto } from './dto/crear-categoria-cliente.dto';

@Injectable()
export class CategoriasClienteService {
  constructor(private readonly categoriasClienteRepository: CategoriasClienteRepository) {}

  crear(dto: CrearCategoriaClienteDto, tenantId: string) {
    return this.categoriasClienteRepository.crear(dto, tenantId);
  }

  listar(soloActivas: boolean) {
    return this.categoriasClienteRepository.listar(soloActivas);
  }

  buscarPorId(id: string) {
    return this.categoriasClienteRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearCategoriaClienteDto>) {
    return this.categoriasClienteRepository.actualizar(id, dto);
  }
}
