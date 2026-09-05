import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ClaudeVisionAdapter } from './claude-vision.adapter';
import { OpenAiVisionAdapter } from './openai-vision.adapter';
import { GeminiVisionAdapter } from './gemini-vision.adapter';
import { AnalizadorImagenAdapter, CandidatoProducto, ModeloIa } from './analizador-imagen.interface';

export const PROVEEDORES_IA_IMAGEN = ['claude', 'openai', 'gemini'] as const;
export type ProveedorIaImagen = (typeof PROVEEDORES_IA_IMAGEN)[number];

/** Único punto que sabe qué proveedor de IA está activo (IA_IMAGEN_PROVEEDOR_ACTIVO) — mismo criterio que PasarelaPagoService. */
@Injectable()
export class AnalizadorImagenService {
  constructor(
    private readonly claudeAdapter: ClaudeVisionAdapter,
    private readonly openAiAdapter: OpenAiVisionAdapter,
    private readonly geminiAdapter: GeminiVisionAdapter,
  ) {}

  private get adaptadores(): Record<string, AnalizadorImagenAdapter> {
    return { claude: this.claudeAdapter, openai: this.openAiAdapter, gemini: this.geminiAdapter };
  }

  get activo(): AnalizadorImagenAdapter {
    const clave = process.env.IA_IMAGEN_PROVEEDOR_ACTIVO || 'claude';
    return this.adaptadores[clave] ?? this.claudeAdapter;
  }

  /** Lista de modelos reales de UN proveedor puntual (no necesariamente el activo) — para el selector de `/plataforma/configuración`. */
  async listarModelos(proveedor: string): Promise<ModeloIa[]> {
    const adapter = this.adaptadores[proveedor];
    if (!adapter) throw new BadRequestException(`Proveedor "${proveedor}" no reconocido`);
    return adapter.listarModelos();
  }

  /** `dataUri` completa (`data:image/...;base64,...`) — misma validación de formato que ya usa CrearProductoDto.imagen. */
  async analizarDesdeDataUri(dataUri: string): Promise<CandidatoProducto[]> {
    const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUri);
    if (!match) throw new ServiceUnavailableException('La imagen no tiene un formato válido');
    const [, mimeType, base64] = match;

    const adapter = this.activo;
    if (!adapter.habilitado) {
      throw new ServiceUnavailableException(`Generar con IA no está disponible todavía (proveedor "${adapter.clave}" sin configurar)`);
    }
    return adapter.analizar(base64, mimeType);
  }
}
