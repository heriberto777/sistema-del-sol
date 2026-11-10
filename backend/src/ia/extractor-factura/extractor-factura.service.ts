import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ClaudeFacturaAdapter } from './claude-factura.adapter';
import { FacturaExtraida } from './extractor-factura.interface';

/**
 * Benchmark 2026-11-09 (Fase 10) — un solo proveedor por ahora (Claude,
 * ya configurado vía `ANTHROPIC_API_KEY` para el resto de la IA del
 * proyecto). Mismo criterio estructural que `AnalizadorImagenService`
 * (un único punto que sabe qué adapter usar) pero sin selector
 * multi-proveedor todavía — extender con OpenAI/Gemini es agregar un
 * adapter más acá si hace falta más adelante, no un cambio de arquitectura.
 */
@Injectable()
export class ExtractorFacturaService {
  constructor(private readonly claudeAdapter: ClaudeFacturaAdapter) {}

  async extraerDesdeDataUri(dataUri: string): Promise<FacturaExtraida> {
    const match = /^data:(image\/[a-z]+|application\/pdf);base64,(.+)$/.exec(dataUri);
    if (!match) throw new ServiceUnavailableException('El archivo no tiene un formato válido (debe ser imagen o PDF)');
    const [, mimeType, base64] = match;

    if (!this.claudeAdapter.habilitado) {
      throw new ServiceUnavailableException('Crear desde imagen/PDF no está disponible todavía (proveedor de IA sin configurar)');
    }
    return this.claudeAdapter.extraer(base64, mimeType);
  }
}
