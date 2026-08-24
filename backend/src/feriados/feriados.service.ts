import { Injectable } from '@nestjs/common';
import { FeriadosRepository } from './feriados.repository';
import { CrearFeriadoDto } from './dto/crear-feriado.dto';

@Injectable()
export class FeriadosService {
  constructor(private readonly feriadosRepository: FeriadosRepository) {}

  crear(dto: CrearFeriadoDto, tenantId: string) {
    return this.feriadosRepository.crear(dto, tenantId);
  }

  listar(soloActivos: boolean) {
    return this.feriadosRepository.listar(soloActivos);
  }

  actualizar(id: string, dto: Partial<CrearFeriadoDto>) {
    return this.feriadosRepository.actualizar(id, dto);
  }

  eliminar(id: string) {
    return this.feriadosRepository.eliminar(id);
  }
}
