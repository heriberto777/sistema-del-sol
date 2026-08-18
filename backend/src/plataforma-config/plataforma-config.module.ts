import { Module } from '@nestjs/common';
import { PlataformaConfigController } from './plataforma-config.controller';
import { PlataformaConfigService } from './plataforma-config.service';
import { PlataformaConfigRepository } from './plataforma-config.repository';

@Module({
  controllers: [PlataformaConfigController],
  providers: [PlataformaConfigService, PlataformaConfigRepository],
})
export class PlataformaConfigModule {}
