import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { ConversacionIaService } from '../ia/conversacion/conversacion-ia.service';
import { descifrar } from '../common/utils/encriptado.util';
import { construirPromptGenerarTareas, parsearPlanSugerido, PlanSugerido } from './generar-tareas-ia.prompt';

/**
 * Fase 7 — "Generar tareas con IA". Reusa deliberadamente la IA que el
 * tenant ya configuró para el Bot de WhatsApp (`WhatsappConfigTenant`,
 * Configuraciones → Integraciones) en vez de construir una pantalla de
 * configuración propia para Proyectos: es la única IA que hoy es
 * realmente "del tenant" (key/proveedor propios) en todo el sistema — el
 * resto (analizador de imagen, sugerir cuenta contable, etc.) usa una key
 * compartida a nivel Plataforma. Confirmado con el usuario.
 */
@Injectable()
export class ProyectosIaService {
  constructor(
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly conversacionIaService: ConversacionIaService,
  ) {}

  async generarTareas(tenantId: string, nombreProyecto: string, descripcion: string): Promise<PlanSugerido> {
    const config = await this.whatsappConfigRepository.obtenerOCrear(tenantId);
    if (!config.iaProveedor || !config.iaApiKeyCifrado) {
      throw new BadRequestException(
        'Configurá primero un proveedor de IA en Configuraciones → Integraciones (WhatsApp) para poder generar tareas con IA.',
      );
    }

    const apiKey = descifrar(config.iaApiKeyCifrado);
    const prompt = construirPromptGenerarTareas(nombreProyecto, descripcion);
    const texto = await this.conversacionIaService.completar(config.iaProveedor, [{ role: 'user', content: prompt }], {
      apiKey,
      modelo: config.iaModelo ?? undefined,
      maxTokens: 800,
    });
    if (!texto) {
      throw new ServiceUnavailableException('No se pudieron generar tareas con IA — probá de nuevo en un momento.');
    }

    return parsearPlanSugerido(texto);
  }
}
