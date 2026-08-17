import { Module } from '@nestjs/common';
import { ConfiguracionesService } from './configuraciones.service';
import { ConfiguracionesController } from './configuraciones.controller';
import { ConfiguracionesRepository } from './configuraciones.repository';

@Module({
  controllers: [ConfiguracionesController],
  providers: [ConfiguracionesService, ConfiguracionesRepository],
  exports: [ConfiguracionesService],
})
export class ConfiguracionesModule {}
