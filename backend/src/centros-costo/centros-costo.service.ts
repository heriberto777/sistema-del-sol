import { Injectable } from '@nestjs/common';
import { CentrosCostoRepository } from './centros-costo.repository';
import { CrearCentroCostoDto } from './dto/crear-centro-costo.dto';

@Injectable()
export class CentrosCostoService {
  constructor(private readonly centrosCostoRepository: CentrosCostoRepository) {}

  crear(dto: CrearCentroCostoDto, tenantId: string) {
    return this.centrosCostoRepository.crear(dto, tenantId);
  }

  listar(soloActivos: boolean) {
    return this.centrosCostoRepository.listar(soloActivos);
  }

  /** Tenant-scoped (findUniqueOrThrow vía TenantPrismaService) — para que otros módulos (Gastos Menores, Facturación, Compras, Asientos) validen un id sin tocar el repositorio directo. */
  buscarPorId(id: string) {
    return this.centrosCostoRepository.buscarPorId(id);
  }

  actualizar(id: string, dto: Partial<CrearCentroCostoDto>) {
    return this.centrosCostoRepository.actualizar(id, dto);
  }
}
