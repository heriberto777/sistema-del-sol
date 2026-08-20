import { BadRequestException, Injectable } from '@nestjs/common';
import { PeriodosNominaRepository } from './periodos-nomina.repository';
import { EmpleadosRepository } from './empleados.repository';
import { AusenciasRepository } from './ausencias.repository';
import { GenerarPeriodoDto } from './dto/generar-periodo.dto';
import { calcularRecibo } from './calculo-nomina';
import { DIVISOR_SALARIO_DIARIO } from './nomina-config';
import { contarDiasNoDomingo } from './vacaciones.util';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { paginar } from '../common/types/pagina-resultado';
import { ListarPeriodosNominaQueryDto } from './dto/listar-periodos-nomina-query.dto';

@Injectable()
export class PeriodosNominaService {
  constructor(
    private readonly periodosRepository: PeriodosNominaRepository,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly ausenciasRepository: AusenciasRepository,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Días de ausencia sin goce de sueldo del empleado que se solapan con el
   * período, excluyendo domingos — simplificación consciente (Fase 7d): no
   * distingue contra `HorarioEmpleado`, así el cálculo de nómina no depende
   * de si RRHH configuró un horario o no. Recorta cada ausencia a los
   * límites del período antes de contar (una ausencia puede empezar antes
   * o terminar después del período).
   */
  private async diasDescuentoAusencias(empleadoId: string, fechaInicio: Date, fechaFin: Date) {
    const ausencias = await this.ausenciasRepository.listarSinGoceSolapadas(empleadoId, fechaInicio, fechaFin);
    return ausencias.reduce((acc, a) => {
      const desde = a.fechaDesde > fechaInicio ? a.fechaDesde : fechaInicio;
      const hasta = a.fechaHasta < fechaFin ? a.fechaHasta : fechaFin;
      return acc + contarDiasNoDomingo(desde, hasta);
    }, 0);
  }

  /** Genera un recibo por cada empleado activo, calculado sobre su salario vigente en este momento. */
  async generarPeriodo(dto: GenerarPeriodoDto, tenantId: string) {
    const empleados = await this.empleadosRepository.listarActivos();
    if (empleados.length === 0) {
      throw new BadRequestException('No hay empleados activos para generar la nómina');
    }

    const factorPeriodo = dto.tipo === 'QUINCENAL' ? 0.5 : 1;
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);

    const recibos = await Promise.all(
      empleados.map(async (empleado) => {
        const salarioBrutoMensual = Number(empleado.salarioBrutoMensual);
        const diasDescuento = await this.diasDescuentoAusencias(empleado.id, fechaInicio, fechaFin);
        const descuentoAusencias = diasDescuento * (salarioBrutoMensual / DIVISOR_SALARIO_DIARIO);
        return { empleadoId: empleado.id, ...calcularRecibo(salarioBrutoMensual, factorPeriodo, 0, descuentoAusencias) };
      }),
    );

    return this.periodosRepository.crear({
      tenantId,
      tipo: dto.tipo,
      fechaInicio,
      fechaFin,
      recibos,
    });
  }

  buscarPorId(id: string) {
    return this.periodosRepository.buscarPorId(id);
  }

  async listar(query: ListarPeriodosNominaQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.periodosRepository.listar({ skip, take, estado: query.estado });
    return { datos, total, pagina, tamanoPagina };
  }

  /** BORRADOR -> PROCESADO: congela el período (ya no se regenera). */
  async procesar(id: string) {
    const periodo = await this.periodosRepository.buscarPorId(id);
    if (periodo.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo un período en BORRADOR puede procesarse');
    }
    return this.periodosRepository.actualizarEstado(id, 'PROCESADO');
  }

  /** PROCESADO -> PAGADO: dispara el asiento contable automático (ver ContabilidadEventosService.alPagarNomina). */
  async marcarPagado(id: string) {
    const periodo = await this.periodosRepository.buscarPorId(id);
    if (periodo.estado !== 'PROCESADO') {
      throw new BadRequestException('Solo un período PROCESADO puede marcarse como pagado');
    }

    const actualizado = await this.periodosRepository.actualizarEstado(id, 'PAGADO', new Date());

    const sumar = (
      campo:
        | 'salarioBruto'
        | 'sfsEmpleado'
        | 'afpEmpleado'
        | 'isr'
        | 'otrasDeducciones'
        | 'descuentoAusencias'
        | 'salarioNeto'
        | 'sfsEmpleador'
        | 'afpEmpleador'
        | 'infotep',
    ) => actualizado.recibos.reduce((acc, r) => acc + Number(r[campo]), 0);

    this.eventBus.emit(EVENTOS.NOMINA_PERIODO_PAGADO, {
      tenantId: actualizado.tenantId,
      periodoId: actualizado.id,
      totalSalarioBruto: String(sumar('salarioBruto')),
      totalSfsEmpleado: String(sumar('sfsEmpleado')),
      totalAfpEmpleado: String(sumar('afpEmpleado')),
      totalIsr: String(sumar('isr')),
      totalOtrasDeducciones: String(sumar('otrasDeducciones')),
      totalDescuentoAusencias: String(sumar('descuentoAusencias')),
      totalSalarioNeto: String(sumar('salarioNeto')),
      totalSfsEmpleador: String(sumar('sfsEmpleador')),
      totalAfpEmpleador: String(sumar('afpEmpleador')),
      totalInfotep: String(sumar('infotep')),
    });

    return actualizado;
  }

  /**
   * Planilla de aportes TSS (SFS + AFP, empleado y empleador) e ISR
   * retenido del período, por empleado — la base para remitir a la TSS
   * (DGT3) y el ISR retenido a la DGII. No es el layout oficial de esos
   * formularios (igual que reportes-fiscales/exportador-fiscal.ts para
   * 606/607/608): son los montos reales ya calculados en cada recibo.
   */
  async reporteAportes(id: string) {
    const periodo = await this.periodosRepository.buscarPorId(id);

    const empleados = periodo.recibos.map((r) => ({
      empleadoId: r.empleadoId,
      cedula: r.empleado.cedula,
      nombre: r.empleado.nombre,
      salarioBruto: Number(r.salarioBruto),
      sfsEmpleado: Number(r.sfsEmpleado),
      sfsEmpleador: Number(r.sfsEmpleador),
      afpEmpleado: Number(r.afpEmpleado),
      afpEmpleador: Number(r.afpEmpleador),
      infotep: Number(r.infotep),
      isr: Number(r.isr),
    }));

    const sumar = (campo: 'salarioBruto' | 'sfsEmpleado' | 'sfsEmpleador' | 'afpEmpleado' | 'afpEmpleador' | 'infotep' | 'isr') =>
      empleados.reduce((acc, e) => acc + e[campo], 0);

    return {
      periodoId: periodo.id,
      fechaInicio: periodo.fechaInicio,
      fechaFin: periodo.fechaFin,
      empleados,
      totales: {
        salarioBruto: sumar('salarioBruto'),
        sfsEmpleado: sumar('sfsEmpleado'),
        sfsEmpleador: sumar('sfsEmpleador'),
        totalSfs: sumar('sfsEmpleado') + sumar('sfsEmpleador'),
        afpEmpleado: sumar('afpEmpleado'),
        afpEmpleador: sumar('afpEmpleador'),
        totalAfp: sumar('afpEmpleado') + sumar('afpEmpleador'),
        infotep: sumar('infotep'),
        isr: sumar('isr'),
      },
    };
  }
}
