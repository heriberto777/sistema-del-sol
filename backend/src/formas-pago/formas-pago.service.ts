import { Injectable } from '@nestjs/common';
import { FormasPagoRepository } from './formas-pago.repository';
import { CrearFormaPagoDto } from './dto/crear-forma-pago.dto';

@Injectable()
export class FormasPagoService {
  constructor(private readonly formasPagoRepository: FormasPagoRepository) {}

  async crear(dto: CrearFormaPagoDto, tenantId: string) {
    if (dto.esEfectivo) {
      await this.formasPagoRepository.desmarcarEfectivoDeOtras(tenantId);
    }
    return this.formasPagoRepository.crear(dto, tenantId);
  }

  listar(soloActivas: boolean) {
    return this.formasPagoRepository.listar(soloActivas);
  }

  buscarPorId(id: string) {
    return this.formasPagoRepository.buscarPorId(id);
  }

  async actualizar(id: string, dto: Partial<CrearFormaPagoDto>, tenantId: string) {
    if (dto.esEfectivo) {
      await this.formasPagoRepository.desmarcarEfectivoDeOtras(tenantId, id);
    }
    return this.formasPagoRepository.actualizar(id, dto);
  }
}
