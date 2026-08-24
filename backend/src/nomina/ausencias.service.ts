import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoAusencia } from '@prisma/client';
import { AusenciasRepository } from './ausencias.repository';
import { EmpleadosRepository } from './empleados.repository';
import { TiposAusenciaConfigRepository } from './tipos-ausencia-config.repository';
import { CrearAusenciaDto } from './dto/crear-ausencia.dto';
import { ListarAusenciasQueryDto } from './dto/listar-ausencias-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { calcularBalanceVacaciones, contarDiasNoDomingo } from './vacaciones.util';

/**
 * Defaults usados solo si el tenant no tiene fila en TipoAusenciaConfig
 * (provisionado antes de G-2) — mismo criterio de "no romper a nadie el
 * día del deploy" que el resto del proyecto. INJUSTIFICADA es la única
 * con goce=false por defecto.
 */
const CON_GOCE_POR_DEFECTO: Record<TipoAusencia, boolean> = {
  VACACIONES: true,
  ENFERMEDAD: true,
  PERMISO: true,
  MATERNIDAD_PATERNIDAD: true,
  INJUSTIFICADA: false,
  OTRO: true,
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

@Injectable()
export class AusenciasService {
  constructor(
    private readonly ausenciasRepository: AusenciasRepository,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly tiposAusenciaConfigRepository: TiposAusenciaConfigRepository,
  ) {}

  async crear(dto: CrearAusenciaDto, tenantId: string, solicitadoPorId: string) {
    const empleado = await this.empleadosRepository.buscarPorId(dto.empleadoId);

    const fechaDesde = new Date(dto.fechaDesde);
    const fechaHasta = new Date(dto.fechaHasta);
    if (fechaHasta < fechaDesde) {
      throw new BadRequestException('fechaHasta no puede ser anterior a fechaDesde');
    }

    const config = await this.tiposAusenciaConfigRepository.buscarPorTipo(dto.tipo, tenantId);
    if (config && !config.activo) {
      throw new BadRequestException(`El tipo de ausencia ${dto.tipo} está desactivado`);
    }

    if (dto.tipo === 'VACACIONES') {
      const diasSolicitados = contarDiasNoDomingo(fechaDesde, fechaHasta);
      const balance = await this.balanceVacaciones(dto.empleadoId, empleado.fechaIngreso);
      if (diasSolicitados > balance.diasDisponibles) {
        throw new BadRequestException(
          `El empleado tiene ${balance.diasDisponibles} día(s) de vacaciones disponibles — se solicitaron ${diasSolicitados}`,
        );
      }
    } else if (config?.maximoDiasPorAnio != null) {
      const diasSolicitados = Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / MS_POR_DIA) + 1;
      const diasYaUsados = await this.tiposAusenciaConfigRepository.sumarDiasAprobadosEnAnio(
        dto.empleadoId,
        dto.tipo,
        fechaDesde.getFullYear(),
      );
      if (diasYaUsados + diasSolicitados > config.maximoDiasPorAnio) {
        throw new BadRequestException(
          `El tope de ${dto.tipo} es ${config.maximoDiasPorAnio} día(s)/año — ya se usaron ${diasYaUsados} y se solicitan ${diasSolicitados}`,
        );
      }
    }

    const requiereAprobacion = config?.requiereAprobacion ?? true;
    return this.ausenciasRepository.crear({
      tenantId,
      empleadoId: dto.empleadoId,
      tipo: dto.tipo,
      fechaDesde,
      fechaHasta,
      conGoceDeSueldo: dto.conGoceDeSueldo ?? config?.conGoceDeSueldoPorDefecto ?? CON_GOCE_POR_DEFECTO[dto.tipo],
      motivo: dto.motivo,
      solicitadoPorId,
      ...(requiereAprobacion ? {} : { estado: 'APROBADA', aprobadoPorId: solicitadoPorId, fechaResolucion: new Date() }),
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

  /** Balance de vacaciones (Fase 7d) — expuesto también en GET /nomina/empleados/:id/balance-vacaciones. */
  async balanceVacaciones(empleadoId: string, fechaIngreso: Date) {
    const vacacionesAprobadas = await this.ausenciasRepository.listarVacacionesAprobadas(empleadoId);
    const diasYaTomados = vacacionesAprobadas.reduce((acc, v) => acc + contarDiasNoDomingo(v.fechaDesde, v.fechaHasta), 0);
    return calcularBalanceVacaciones(fechaIngreso, diasYaTomados);
  }
}
