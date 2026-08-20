import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoAusencia } from '@prisma/client';
import { AusenciasRepository } from './ausencias.repository';
import { EmpleadosRepository } from './empleados.repository';
import { CrearAusenciaDto } from './dto/crear-ausencia.dto';
import { ListarAusenciasQueryDto } from './dto/listar-ausencias-query.dto';
import { paginar } from '../common/types/pagina-resultado';

/** INJUSTIFICADA es la única con goce=false por defecto — el resto se asume pagada salvo que el caller lo indique explícito. */
const CON_GOCE_POR_DEFECTO: Record<TipoAusencia, boolean> = {
  VACACIONES: true,
  ENFERMEDAD: true,
  PERMISO: true,
  MATERNIDAD_PATERNIDAD: true,
  INJUSTIFICADA: false,
  OTRO: true,
};

@Injectable()
export class AusenciasService {
  constructor(
    private readonly ausenciasRepository: AusenciasRepository,
    private readonly empleadosRepository: EmpleadosRepository,
  ) {}

  async crear(dto: CrearAusenciaDto, tenantId: string, solicitadoPorId: string) {
    await this.empleadosRepository.buscarPorId(dto.empleadoId);

    const fechaDesde = new Date(dto.fechaDesde);
    const fechaHasta = new Date(dto.fechaHasta);
    if (fechaHasta < fechaDesde) {
      throw new BadRequestException('fechaHasta no puede ser anterior a fechaDesde');
    }

    return this.ausenciasRepository.crear({
      tenantId,
      empleadoId: dto.empleadoId,
      tipo: dto.tipo,
      fechaDesde,
      fechaHasta,
      conGoceDeSueldo: dto.conGoceDeSueldo ?? CON_GOCE_POR_DEFECTO[dto.tipo],
      motivo: dto.motivo,
      solicitadoPorId,
    });
  }

  buscarPorId(id: string) {
    return this.ausenciasRepository.buscarPorId(id);
  }

  async cambiarEstado(id: string, estado: 'APROBADA' | 'RECHAZADA', aprobadoPorId: string) {
    const ausencia = await this.ausenciasRepository.buscarPorId(id);
    if (ausencia.estado !== 'SOLICITADA') {
      throw new BadRequestException('Solo una ausencia SOLICITADA puede aprobarse o rechazarse');
    }
    return this.ausenciasRepository.actualizarEstado(id, estado, aprobadoPorId, new Date());
  }

  async listar(query: ListarAusenciasQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.ausenciasRepository.listar({ empleadoId: query.empleadoId, estado: query.estado, skip, take });
    return { datos, total, pagina, tamanoPagina };
  }
}
