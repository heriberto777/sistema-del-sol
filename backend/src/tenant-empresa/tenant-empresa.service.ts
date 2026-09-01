import { Injectable } from '@nestjs/common';
import { TenantEmpresaRepository } from './tenant-empresa.repository';
import { ActualizarTenantEmpresaDto } from './dto/actualizar-tenant-empresa.dto';

@Injectable()
export class TenantEmpresaService {
  constructor(private readonly tenantEmpresaRepository: TenantEmpresaRepository) {}

  obtener(tenantId: string) {
    return this.tenantEmpresaRepository.obtener(tenantId);
  }

  actualizar(tenantId: string, dto: ActualizarTenantEmpresaDto) {
    return this.tenantEmpresaRepository.actualizar(tenantId, dto);
  }
}
