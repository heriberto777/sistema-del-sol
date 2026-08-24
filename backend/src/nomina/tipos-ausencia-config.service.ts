import { Injectable } from '@nestjs/common';
import { TipoAusencia } from '@prisma/client';
import { TiposAusenciaConfigRepository } from './tipos-ausencia-config.repository';
import { ActualizarTipoAusenciaConfigDto } from './dto/actualizar-tipo-ausencia-config.dto';

@Injectable()
export class TiposAusenciaConfigService {
  constructor(private readonly repository: TiposAusenciaConfigRepository) {}

  listar() {
    return this.repository.listar();
  }

  actualizar(tipo: TipoAusencia, tenantId: string, dto: ActualizarTipoAusenciaConfigDto) {
    // VACACIONES usa el balance legal por antigüedad (vacaciones.util.ts) — un
    // tope de días configurable acá sería otra fuente de verdad compitiendo
    // con esa, así que se ignora aunque venga en el body.
    const data = tipo === 'VACACIONES' ? { ...dto, maximoDiasPorAnio: null } : dto;
    return this.repository.actualizar(tipo, tenantId, data);
  }
}
