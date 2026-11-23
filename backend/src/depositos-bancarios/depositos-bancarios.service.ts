import { BadRequestException, Injectable } from '@nestjs/common';
import { DepositosBancariosRepository } from './depositos-bancarios.repository';
import { CrearDepositoBancarioDto } from './dto/crear-deposito-bancario.dto';
import { EditarDepositoBancarioDto } from './dto/editar-deposito-bancario.dto';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { BancosService } from '../bancos/bancos.service';
import { CuentasContablesService } from '../contabilidad/cuentas-contables.service';
import { EstadosFinancierosService } from '../contabilidad/estados-financieros.service';
import { CierrePeriodoService } from '../contabilidad/cierre-periodo.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

/**
 * Depósito bancario (Caja → Banco, docs/PLAN.md) — ver el comentario del
 * modelo `DepositoBancario` en schema.prisma para el diseño completo.
 * Nunca llama a `AsientosContablesService` directo: emite eventos (mismo
 * criterio que el resto de módulos de negocio, ver EventBusService) y
 * `ContabilidadEventosService` los reacciona — la única razón por la que
 * `excedioSaldo` se calcula ACÁ y no en el listener es que tiene que
 * quedar grabado en la respuesta al usuario, y el listener corre async,
 * desacoplado de este request.
 */
@Injectable()
export class DepositosBancariosService {
  constructor(
    private readonly repository: DepositosBancariosRepository,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly bancosService: BancosService,
    private readonly cuentasContablesService: CuentasContablesService,
    private readonly estadosFinancierosService: EstadosFinancierosService,
    private readonly cierrePeriodoService: CierrePeriodoService,
    private readonly eventBus: EventBusService,
  ) {}

  private async saldoActualDeCaja(tenantId: string): Promise<number> {
    const cuentaCaja = await this.cuentasContablesService.resolverCuentaCaja(tenantId);
    const libro = await this.estadosFinancierosService.libroMayor(cuentaCaja.id);
    return libro.saldoFinal;
  }

  async crear(dto: CrearDepositoBancarioDto, tenantId: string, userId: string) {
    const cuentaBancaria = await this.bancosService.buscarPorId(dto.cuentaBancariaId);
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    await this.cierrePeriodoService.validarPeriodoAbierto(fecha);

    const saldoActual = await this.saldoActualDeCaja(tenantId);
    const excedioSaldo = dto.monto > saldoActual;

    const deposito = await this.repository.crear({
      tenantId,
      numero: await this.correlativosRepository.siguiente(tenantId, 'DEPOSITO_BANCARIO'),
      fecha,
      cuentaBancariaId: dto.cuentaBancariaId,
      monto: dto.monto,
      numeroComprobante: dto.numeroComprobante,
      bodegaId: dto.bodegaId,
      notas: dto.notas,
      excedioSaldo,
      saldoDisponibleAlMomento: saldoActual,
      userId,
    });

    this.eventBus.emit(EVENTOS.DEPOSITO_BANCARIO_CREADO, {
      tenantId,
      depositoId: deposito.id,
      cuentaBancariaCuentaContableId: cuentaBancaria.cuentaContableId,
      monto: String(dto.monto),
    });

    return deposito;
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.repository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.repository.buscarPorId(id);
  }

  async editar(id: string, dto: EditarDepositoBancarioDto, tenantId: string) {
    const actual = await this.repository.buscarPorId(id);
    if (actual.estado !== 'ABIERTO') {
      throw new BadRequestException('Solo se puede editar un depósito ABIERTO — uno anulado no se puede modificar.');
    }
    const fecha = dto.fecha ? new Date(dto.fecha) : actual.fecha;
    await this.cierrePeriodoService.validarPeriodoAbierto(fecha);

    const cuentaBancariaNueva = await this.bancosService.buscarPorId(dto.cuentaBancariaId);

    // Saldo de Caja SIN el efecto del depósito viejo (que fue un crédito a
    // Caja por `actual.monto` — revertirlo se lo devuelve al saldo) — ver
    // el comentario de la clase sobre por qué esto se calcula acá y no
    // esperando a que el listener async procese la reversa.
    const saldoSinDepositoViejo = (await this.saldoActualDeCaja(tenantId)) + Number(actual.monto);
    const excedioSaldo = dto.monto > saldoSinDepositoViejo;

    const actualizado = await this.repository.actualizar(id, {
      fecha,
      cuentaBancariaId: dto.cuentaBancariaId,
      monto: dto.monto,
      numeroComprobante: dto.numeroComprobante ?? null,
      bodegaId: dto.bodegaId ?? null,
      notas: dto.notas ?? null,
      excedioSaldo,
      saldoDisponibleAlMomento: saldoSinDepositoViejo,
    });

    this.eventBus.emit(EVENTOS.DEPOSITO_BANCARIO_EDITADO, {
      tenantId,
      depositoId: id,
      cuentaBancariaCuentaContableIdAnterior: actual.cuentaBancaria.cuentaContableId,
      montoAnterior: String(actual.monto),
      cuentaBancariaCuentaContableIdNuevo: cuentaBancariaNueva.cuentaContableId,
      montoNuevo: String(dto.monto),
    });

    return actualizado;
  }

  async anular(id: string, tenantId: string) {
    const actual = await this.repository.buscarPorId(id);
    if (actual.estado !== 'ABIERTO') {
      throw new BadRequestException('Este depósito ya está anulado.');
    }
    await this.cierrePeriodoService.validarPeriodoAbierto(actual.fecha);

    const anulado = await this.repository.marcarAnulado(id);

    this.eventBus.emit(EVENTOS.DEPOSITO_BANCARIO_ANULADO, {
      tenantId,
      depositoId: id,
      cuentaBancariaCuentaContableId: actual.cuentaBancaria.cuentaContableId,
      monto: String(actual.monto),
    });

    return anulado;
  }
}
