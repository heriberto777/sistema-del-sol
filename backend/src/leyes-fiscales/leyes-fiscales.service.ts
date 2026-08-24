import { Injectable } from '@nestjs/common';
import { LeyesFiscalesRepository } from './leyes-fiscales.repository';
import { CrearLeyFiscalDto } from './dto/crear-ley-fiscal.dto';

@Injectable()
export class LeyesFiscalesService {
  constructor(private readonly leyesFiscalesRepository: LeyesFiscalesRepository) {}

  crear(dto: CrearLeyFiscalDto, tenantId: string) {
    return this.leyesFiscalesRepository.crear(dto, tenantId);
  }

  listar(soloActivas: boolean) {
    return this.leyesFiscalesRepository.listar(soloActivas);
  }

  actualizar(id: string, dto: Partial<CrearLeyFiscalDto>) {
    return this.leyesFiscalesRepository.actualizar(id, dto);
  }
}
