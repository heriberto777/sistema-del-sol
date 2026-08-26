import { Module } from '@nestjs/common';
import { DocumentosPublicosService } from './documentos-publicos.service';
import { DocumentosPublicosController } from './documentos-publicos.controller';

// PrismaModule es @Global() — no hace falta importarlo acá.
@Module({
  controllers: [DocumentosPublicosController],
  providers: [DocumentosPublicosService],
})
export class DocumentosPublicosModule {}
