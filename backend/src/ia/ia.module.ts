import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaClientService } from './ia-client.service';
import { IaController } from './ia.controller';
import { ReportesModule } from '../reportes/reportes.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { AnalizadorImagenService } from './analizador-imagen/analizador-imagen.service';
import { ClaudeVisionAdapter } from './analizador-imagen/claude-vision.adapter';
import { OpenAiVisionAdapter } from './analizador-imagen/openai-vision.adapter';
import { GeminiVisionAdapter } from './analizador-imagen/gemini-vision.adapter';

@Module({
  imports: [ReportesModule, ContabilidadModule],
  controllers: [IaController],
  providers: [IaService, IaClientService, AnalizadorImagenService, ClaudeVisionAdapter, OpenAiVisionAdapter, GeminiVisionAdapter],
  exports: [IaClientService, AnalizadorImagenService],
})
export class IaModule {}
