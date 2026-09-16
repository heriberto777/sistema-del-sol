import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoUsoIa } from '@prisma/client';
import { UsoIaRepository } from './uso-ia.repository';

const ETIQUETA_TIPO: Record<TipoUsoIa, string> = {
  IMAGEN_PRODUCTO: 'análisis de imagen',
  ASISTENTE: 'asistente de IA',
};

/**
 * Auditoría de integraciones (2026-09) — "Generar con IA" (imagen de
 * producto) y el asistente de texto (sugerir cuenta contable, generar
 * descripción) pegan a una cuenta compartida de Plataforma sin ningún
 * tope, a diferencia del fondo de banner de Publicaciones Sociales que sí
 * lo tiene desde el día uno (ver PublicacionesSocialesService.generarImagen).
 * Mismo patrón acá: contar uso real del mes contra un límite configurable
 * en Plataforma → Configuración, y cortar ANTES de gastar la llamada
 * pagada — nunca después.
 */
@Injectable()
export class UsoIaService {
  constructor(private readonly usoIaRepository: UsoIaRepository) {}

  /**
   * Para features SIN alternativa sin IA (ej. analizar una foto) — corta
   * con un error claro, mismo criterio que
   * PublicacionesSocialesService.generarImagen con el fondo de banner.
   */
  async verificarYRegistrar(tenantId: string, tipo: TipoUsoIa): Promise<void> {
    const permitido = await this.intentarRegistrar(tenantId, tipo);
    if (!permitido) {
      const limite = (await this.usoIaRepository.buscarLimites())[tipo === 'IMAGEN_PRODUCTO' ? 'imagen' : 'asistente'];
      throw new BadRequestException(`Alcanzaste el límite de ${limite} uso(s) de ${ETIQUETA_TIPO[tipo]} este mes`);
    }
  }

  /**
   * Para features que YA degradan a un modo sin IA cuando no hay API key
   * (ej. IaService — sugerir cuenta contable, descripciones): tratar el
   * límite alcanzado igual que "IA no disponible" en vez de un error nuevo,
   * para no romper el contrato de "esto nunca falla, en el peor caso
   * devuelve la versión sin IA" que ya tienen esos métodos.
   */
  async intentarRegistrar(tenantId: string, tipo: TipoUsoIa): Promise<boolean> {
    const [usados, limites] = await Promise.all([this.usoIaRepository.contarDelMes(tipo), this.usoIaRepository.buscarLimites()]);
    const limite = tipo === 'IMAGEN_PRODUCTO' ? limites.imagen : limites.asistente;
    if (usados >= limite) return false;
    await this.usoIaRepository.registrar(tenantId, tipo);
    return true;
  }

  /** Para mostrar "te quedan N de M" en el frontend antes de intentar generar — no registra nada. */
  async consultar(tipo: TipoUsoIa): Promise<{ usados: number; limite: number }> {
    const [usados, limites] = await Promise.all([this.usoIaRepository.contarDelMes(tipo), this.usoIaRepository.buscarLimites()]);
    return { usados, limite: tipo === 'IMAGEN_PRODUCTO' ? limites.imagen : limites.asistente };
  }
}
