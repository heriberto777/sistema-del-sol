import { BadRequestException, Injectable } from '@nestjs/common';
import { EtapasPipelineRepository } from './etapas-pipeline.repository';
import { CrearEtapaPipelineDto } from './dto/crear-etapa-pipeline.dto';

/** 4 etapas sensatas para no dejar el Kanban vacío al activar el módulo — editable/reemplazable desde Configuración apenas se quiera. */
const ETAPAS_DEFAULT: Omit<CrearEtapaPipelineDto, never>[] = [
  { nombre: 'Prospección', orden: 1, probabilidadDefault: 10, color: '#94a3b8' },
  { nombre: 'Calificación', orden: 2, probabilidadDefault: 30, color: '#60a5fa' },
  { nombre: 'Propuesta', orden: 3, probabilidadDefault: 60, color: '#c2660c' },
  { nombre: 'Negociación', orden: 4, probabilidadDefault: 80, color: '#f59e0b' },
];

@Injectable()
export class EtapasPipelineService {
  constructor(private readonly etapasPipelineRepository: EtapasPipelineRepository) {}

  async crear(dto: CrearEtapaPipelineDto, tenantId: string) {
    return this.etapasPipelineRepository.crear(dto, tenantId);
  }

  /** Sembrado perezoso (sin seed script ni hook de activación de módulo — ver el artifact de diseño) — se ejecuta una sola vez, la próxima llamada ya encuentra filas. */
  async obtenerOSembrar(tenantId: string) {
    const total = await this.etapasPipelineRepository.contar();
    if (total === 0) {
      await this.etapasPipelineRepository.crearVarias(ETAPAS_DEFAULT.map((e) => ({ ...e, tenantId })));
    }
    return this.etapasPipelineRepository.listar();
  }

  buscarPorId(id: string) {
    return this.etapasPipelineRepository.buscarPorId(id);
  }

  async actualizar(id: string, dto: Partial<CrearEtapaPipelineDto>) {
    await this.etapasPipelineRepository.buscarPorId(id);
    return this.etapasPipelineRepository.actualizar(id, dto);
  }

  async eliminar(id: string) {
    await this.etapasPipelineRepository.buscarPorId(id);
    try {
      await this.etapasPipelineRepository.eliminar(id);
    } catch {
      throw new BadRequestException('No se puede eliminar una etapa con oportunidades abiertas — movelas a otra etapa primero.');
    }
  }
}
