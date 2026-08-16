import { Injectable } from '@nestjs/common';
import { TipoNcf } from '@prisma/client';
import { GastosMenoresRepository } from './gastos-menores.repository';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearGastoMenorDto } from './dto/crear-gasto-menor.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class GastosMenoresService {
  constructor(
    private readonly gastosMenoresRepository: GastosMenoresRepository,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Requiere que el tenant tenga una secuencia de NCF activa para B11
   * (tradicional) o E43 (modalidad ECF) — mismo requisito que Facturación
   * tiene para B02/E32. Si no existe, `siguienteNumeroEnTx` lanza (404) —
   * mismo comportamiento que si Facturación se quedara sin secuencia.
   */
  async crear(dto: CrearGastoMenorDto, tenantId: string) {
    const lineasCalculadas = dto.lineas.map((linea) => {
      const cantidad = linea.cantidad ?? 1;
      const porcentajeItbis = linea.porcentajeItbis ?? 0;
      const montoItbis = linea.valor * cantidad * (porcentajeItbis / 100);
      return {
        cuentaContableId: linea.cuentaContableId,
        concepto: linea.concepto,
        valor: linea.valor,
        porcentajeItbis,
        montoItbis,
        cantidad,
        montoTotal: linea.valor * cantidad + montoItbis,
      };
    });

    const monto = lineasCalculadas.reduce((acc, l) => acc + l.valor * l.cantidad, 0);
    const itbis = lineasCalculadas.reduce((acc, l) => acc + l.montoItbis, 0);
    const total = monto + itbis;

    const modalidad = await this.gastosMenoresRepository.obtenerModalidadFacturacion(tenantId);
    const tipoNcf: TipoNcf = modalidad === 'ECF' ? 'E43' : 'B11';
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

    const gastoMenor = await this.tenantPrisma.client.$transaction(async (tx) => {
      const ncf = await this.gastosMenoresRepository.siguienteNumeroEnTx(tx, tipoNcf);
      return this.gastosMenoresRepository.crearEnTx(tx, {
        tenantId,
        ncf,
        tipoNcf,
        notas: dto.notas,
        fecha,
        cuentaBancariaId: dto.cuentaBancariaId,
        monto,
        itbis,
        total,
        lineas: lineasCalculadas,
      });
    });

    this.eventBus.emit(EVENTOS.GASTO_MENOR_CREADO, { tenantId, gastoMenorId: gastoMenor.id });

    return gastoMenor;
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.gastosMenoresRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.gastosMenoresRepository.buscarPorId(id);
  }
}
