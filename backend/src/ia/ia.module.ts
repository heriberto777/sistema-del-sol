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
import { ConversacionIaService } from './conversacion/conversacion-ia.service';
import { ClaudeConversacionAdapter } from './conversacion/claude-conversacion.adapter';
import { OpenAiConversacionAdapter } from './conversacion/openai-conversacion.adapter';
import { GeminiConversacionAdapter } from './conversacion/gemini-conversacion.adapter';

@Module({
  imports: [ReportesModule, ContabilidadModule],
  controllers: [IaController],
  providers: [
    IaService,
    IaClientService,
    AnalizadorImagenService,
    ClaudeVisionAdapter,
    OpenAiVisionAdapter,
    GeminiVisionAdapter,
    ConversacionIaService,
    ClaudeConversacionAdapter,
    OpenAiConversacionAdapter,
    GeminiConversacionAdapter,
  ],
  exports: [IaClientService, AnalizadorImagenService, ConversacionIaService],
})
export class IaModule {}
