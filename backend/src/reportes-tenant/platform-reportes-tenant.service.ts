import { Injectable } from '@nestjs/common';
import { PlatformReportesTenantRepository } from './platform-reportes-tenant.repository';
import { ListarReportesTenantQueryDto } from './dto/listar-reportes-tenant-query.dto';
import { ResponderReporteTenantDto } from './dto/responder-reporte-tenant.dto';

@Injectable()
export class PlatformReportesTenantService {
  constructor(private readonly repository: PlatformReportesTenantRepository) {}

  listar(query: ListarReportesTenantQueryDto) {
    return this.repository.listar(query);
  }

  responder(id: string, dto: ResponderReporteTenantDto, adminId: string) {
    // findUniqueOrThrow dentro de buscarPorId no hace falta acá — update
    // sobre un id inexistente ya lanza P2025 (Nest lo traduce a 404 vía el
    // filtro global de excepciones de Prisma, mismo criterio que el resto
    // del proyecto).
    return this.repository.responder(id, dto, adminId);
  }

  contarNuevos() {
    return this.repository.contarNuevos();
  }
}
