import { Module } from '@nestjs/common';
import { TenantEmpresaController } from './tenant-empresa.controller';
import { TenantEmpresaService } from './tenant-empresa.service';
import { TenantEmpresaRepository } from './tenant-empresa.repository';

@Module({
  controllers: [TenantEmpresaController],
  providers: [TenantEmpresaService, TenantEmpresaRepository],
})
export class TenantEmpresaModule {}
