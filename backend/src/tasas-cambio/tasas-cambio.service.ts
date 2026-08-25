import { Injectable } from '@nestjs/common';
import { TasasCambioRepository } from './tasas-cambio.repository';
import { CrearTasaCambioDto } from './dto/crear-tasa-cambio.dto';

@Injectable()
export class TasasCambioService {
  constructor(private readonly tasasCambioRepository: TasasCambioRepository) {}

  crear(dto: CrearTasaCambioDto, tenantId: string) {
    return this.tasasCambioRepository.crear({ ...dto, moneda: dto.moneda.toUpperCase() }, tenantId);
  }

  listar() {
    return this.tasasCambioRepository.listar();
  }

  buscarPorMoneda(moneda: string) {
    return this.tasasCambioRepository.buscarPorMoneda(moneda.toUpperCase());
  }

  actualizar(id: string, dto: Partial<CrearTasaCambioDto>) {
    return this.tasasCambioRepository.actualizar(id, dto.moneda ? { ...dto, moneda: dto.moneda.toUpperCase() } : dto);
  }

  eliminar(id: string) {
    return this.tasasCambioRepository.eliminar(id);
  }
}
