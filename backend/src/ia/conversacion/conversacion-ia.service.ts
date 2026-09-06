import { BadRequestException, Injectable } from '@nestjs/common';
import { ClaudeConversacionAdapter } from './claude-conversacion.adapter';
import { OpenAiConversacionAdapter } from './openai-conversacion.adapter';
import { GeminiConversacionAdapter } from './gemini-conversacion.adapter';
import { ConversacionIaAdapter, MensajeConversacion, OpcionesConversacionIa } from './conversacion-ia.interface';
import { ModeloIa } from '../analizador-imagen/analizador-imagen.interface';

/**
 * Resuelve qué proveedor usar para el bot de WhatsApp de un tenant
 * (`WhatsappConfigTenant.iaProveedor`) — mismo criterio que
 * AnalizadorImagenService, pero acá la key/modelo vienen del tenant en
 * cada llamada (`OpcionesConversacionIa.apiKey`), no de `process.env`.
 * Un `iaProveedor` vacío/desconocido cae a Claude, igual que antes de
 * que este selector tuviera efecto real.
 */
@Injectable()
export class ConversacionIaService {
  constructor(
    private readonly claudeAdapter: ClaudeConversacionAdapter,
    private readonly openAiAdapter: OpenAiConversacionAdapter,
    private readonly geminiAdapter: GeminiConversacionAdapter,
  ) {}

  private get adaptadores(): Record<string, ConversacionIaAdapter> {
    return { ANTHROPIC: this.claudeAdapter, OPENAI: this.openAiAdapter, GEMINI: this.geminiAdapter };
  }

  async completar(proveedor: string | null | undefined, mensajes: MensajeConversacion[], opciones: OpcionesConversacionIa): Promise<string | null> {
    const adapter = (proveedor && this.adaptadores[proveedor]) || this.claudeAdapter;
    return adapter.completar(mensajes, opciones);
  }

  /** Lista de modelos reales de UN proveedor puntual, usando la API key ya guardada de ESE tenant — para el selector de WhatsappConfigPanel. */
  async listarModelos(proveedor: string, apiKey: string): Promise<ModeloIa[]> {
    const adapter = this.adaptadores[proveedor];
    if (!adapter) throw new BadRequestException(`Proveedor "${proveedor}" no reconocido`);
    return adapter.listarModelos(apiKey);
  }
}
