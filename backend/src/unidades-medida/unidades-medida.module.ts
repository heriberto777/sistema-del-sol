import { Module } from '@nestjs/common';
import { UnidadesMedidaService } from './unidades-medida.service';
import { UnidadesMedidaController } from './unidades-medida.controller';
import { UnidadesMedidaRepository } from './unidades-medida.repository';

@Module({
  controllers: [UnidadesMedidaController],
  providers: [UnidadesMedidaService, UnidadesMedidaRepository],
  exports: [UnidadesMedidaService, UnidadesMedidaRepository],
})
export class UnidadesMedidaModule {}
