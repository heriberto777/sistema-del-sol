import { Module } from '@nestjs/common';
import { PlataformaConfigModule } from '../plataforma-config/plataforma-config.module';
import { NcfPlataformaController } from './ncf-plataforma.controller';
import { NcfPlataformaService } from './ncf-plataforma.service';
import { NcfPlataformaRepository } from './ncf-plataforma.repository';

@Module({
  imports: [PlataformaConfigModule],
  controllers: [NcfPlataformaController],
  providers: [NcfPlataformaService, NcfPlataformaRepository],
  exports: [NcfPlataformaService],
})
export class NcfPlataformaModule {}
