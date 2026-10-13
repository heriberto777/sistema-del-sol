import { Module } from '@nestjs/common';
import { PersonalizacionDocumentosController } from './personalizacion-documentos.controller';
import { PersonalizacionDocumentosService } from './personalizacion-documentos.service';
import { PersonalizacionDocumentosRepository } from './personalizacion-documentos.repository';

@Module({
  controllers: [PersonalizacionDocumentosController],
  providers: [PersonalizacionDocumentosService, PersonalizacionDocumentosRepository],
})
export class PersonalizacionDocumentosModule {}
