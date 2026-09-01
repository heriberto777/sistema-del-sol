import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { TipoNcf } from '@prisma/client';
import { NcfPlataformaRepository } from './ncf-plataforma.repository';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CrearNcfPlataformaDto } from './dto/crear-ncf-plataforma.dto';
import { ActualizarNcfPlataformaDto } from './dto/actualizar-ncf-plataforma.dto';

/** La plataforma siempre le factura a un negocio con RNC (nunca a un consumidor final) — Crédito Fiscal según la modalidad activa. */
const TIPO_CREDITO_FISCAL: Record<'NCF' | 'ECF', TipoNcf> = { NCF: 'B01', ECF: 'E31' };

@Injectable()
export class NcfPlataformaService {
  private readonly logger = new Logger(NcfPlataformaService.name);

  constructor(
    private readonly ncfPlataformaRepository: NcfPlataformaRepository,
    private readonly plataformaConfigRepository: PlataformaConfigRepository,
    private readonly prisma: PrismaService,
  ) {}

  listar() {
    return this.ncfPlataformaRepository.listar();
  }

  async crear(dto: CrearNcfPlataformaDto) {
    const existente = await this.ncfPlataformaRepository.buscarActiva(dto.tipoNcf);
    if (existente) {
      throw new ConflictException(`Ya existe una secuencia activa de ${dto.tipoNcf} — desactivala o editá la existente`);
    }

    return this.ncfPlataformaRepository.crear({
      tipoNcf: dto.tipoNcf,
      secuenciaInicial: dto.secuenciaInicial ?? 1,
      secuenciaFinal: dto.secuenciaFinal,
      vigenciaHasta: new Date(dto.vigenciaHasta),
      umbralAlerta: dto.umbralAlerta,
    });
  }

  actualizar(id: string, dto: ActualizarNcfPlataformaDto) {
    return this.ncfPlataformaRepository.actualizar(id, {
      secuenciaFinal: dto.secuenciaFinal,
      vigenciaHasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : undefined,
      activo: dto.activo,
      umbralAlerta: dto.umbralAlerta,
    });
  }

  /**
   * Llamado por FacturasPlataformaService antes de crear una
   * FacturaPlataforma. Nunca lanza — si no hay secuencia activa o está
   * agotada, loguea un WARN y devuelve null (mismo criterio que
   * Contabilidad/IA/pasarela: nunca bloquea el flujo de negocio que lo
   * llama). La facturación recurrente de TODOS los tenants no puede
   * depender de que alguien haya configurado el NCF de la plataforma.
   */
  async asignarSiguiente(): Promise<{ ncf: string; tipoNcf: TipoNcf } | null> {
    const config = await this.plataformaConfigRepository.obtenerOCrear();
    const tipoNcf = TIPO_CREDITO_FISCAL[config.modalidadFacturacion];
    try {
      return await this.prisma.$transaction((tx) => this.ncfPlataformaRepository.siguienteEnTx(tx, tipoNcf));
    } catch (error) {
      this.logger.warn(`No se pudo asignar NCF ${tipoNcf} a una factura de plataforma: ${(error as Error).message}`);
      return null;
    }
  }
}
