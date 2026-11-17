import { Injectable } from '@nestjs/common';
import { ReportesTenantRepository } from './reportes-tenant.repository';
import { CrearReporteTenantDto } from './dto/crear-reporte-tenant.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class ReportesTenantService {
  constructor(private readonly repository: ReportesTenantRepository) {}

  crear(dto: CrearReporteTenantDto, tenantId: string, usuarioId: string) {
    return this.repository.crear(dto, tenantId, usuarioId);
  }

  async listarPropios(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.repository.listarPropios({ skip, take });
    return { datos, total, pagina, tamanoPagina };
  }
}
