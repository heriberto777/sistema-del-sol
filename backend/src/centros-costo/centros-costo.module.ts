import { Module } from '@nestjs/common';
import { CentrosCostoService } from './centros-costo.service';
import { CentrosCostoController } from './centros-costo.controller';
import { CentrosCostoRepository } from './centros-costo.repository';

@Module({
  controllers: [CentrosCostoController],
  providers: [CentrosCostoService, CentrosCostoRepository],
  exports: [CentrosCostoService, CentrosCostoRepository],
})
export class CentrosCostoModule {}
