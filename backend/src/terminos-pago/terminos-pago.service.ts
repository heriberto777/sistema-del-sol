import { Injectable } from '@nestjs/common';
import { TerminosPagoRepository } from './terminos-pago.repository';
import { CrearTerminoPagoDto } from './dto/crear-termino-pago.dto';

@Injectable()
export class TerminosPagoService {
  constructor(private readonly terminosPagoRepository: TerminosPagoRepository) {}

  crear(dto: CrearTerminoPagoDto, tenantId: string) {
    return this.terminosPagoRepository.crear(dto, tenantId);
  }

  listar(soloActivos: boolean) {
    return this.terminosPagoRepository.listar(soloActivos);
  }

  buscarPorId(id: string) {
    return this.terminosPagoRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearTerminoPagoDto>) {
    return this.terminosPagoRepository.actualizar(id, dto);
  }
}
