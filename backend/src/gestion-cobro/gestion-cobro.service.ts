import { BadRequestException, Injectable } from '@nestjs/common';
import { GestionCobroRepository } from './gestion-cobro.repository';
import { CrearGestionCobroDto } from './dto/crear-gestion-cobro.dto';
import { ProvisionarIncobrableDto } from './dto/provisionar-incobrable.dto';
import { CastigarIncobrableDto } from './dto/castigar-incobrable.dto';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

const ESTADOS_PROVISIONABLES = ['ABIERTA', 'PARCIAL'] as const;

@Injectable()
export class GestionCobroService {
  constructor(
    private readonly repository: GestionCobroRepository,
    private readonly eventBus: EventBusService,
  ) {}

  async crearGestion(dto: CrearGestionCobroDto, tenantId: string, userId: string) {
    const cuenta = await this.repository.buscarCuentaPorFacturaOrThrow(dto.facturaId);
    return this.repository.crearGestion(dto, tenantId, cuenta.clienteId, cuenta.id, userId);
  }

  async listarGestiones(facturaId: string) {
    const cuenta = await this.repository.buscarCuentaPorFacturaOrThrow(facturaId);
    return this.repository.listarGestionesPorCuenta(cuenta.id);
  }

  async estadoIncobrable(facturaId: string) {
    const cuenta = await this.repository.buscarCuentaPorFacturaOrThrow(facturaId);
    return this.repository.buscarProvisionPorCuenta(cuenta.id);
  }

  /**
   * Provisión en dos pasos (método de reserva, decisión explícita del
   * usuario) — acá solo se debita el gasto y se acredita la provisión
   * (contra-activo); la cuenta SIGUE apareciendo en el aging hasta que se
   * castigue de verdad (ver castigar()).
   */
  async provisionar(dto: ProvisionarIncobrableDto, tenantId: string, userId: string) {
    const cuenta = await this.repository.buscarCuentaPorFacturaOrThrow(dto.facturaId);
    if (!ESTADOS_PROVISIONABLES.includes(cuenta.estado as (typeof ESTADOS_PROVISIONABLES)[number])) {
      throw new BadRequestException(`No se puede provisionar una cuenta en estado ${cuenta.estado}`);
    }
    const existente = await this.repository.buscarProvisionPorCuenta(cuenta.id);
    if (existente) {
      throw new BadRequestException(
        existente.estado === 'CASTIGADA' ? 'Esta cuenta ya fue castigada como incobrable' : 'Esta cuenta ya tiene una provisión de incobrable activa',
      );
    }

    const monto = Number(cuenta.saldo);
    const provision = await this.repository.crearProvision(cuenta.id, monto, dto.motivo, tenantId, userId);

    this.eventBus.emit(EVENTOS.CUENTA_POR_COBRAR_PROVISIONADA, {
      tenantId,
      provisionId: provision.id,
      monto: monto.toString(),
    });

    return provision;
  }

  /** Castigo definitivo — recién acá la cuenta sale del activo y del aging de Cuentas por Cobrar. */
  async castigar(dto: CastigarIncobrableDto, tenantId: string) {
    const cuenta = await this.repository.buscarCuentaPorFacturaOrThrow(dto.facturaId);
    const provision = await this.repository.buscarProvisionPorCuenta(cuenta.id);
    if (!provision || provision.estado !== 'PROVISIONADA') {
      throw new BadRequestException('Esta cuenta no tiene una provisión de incobrable activa para castigar');
    }

    const resultado = await this.repository.castigarEnTx(provision.id, cuenta.id);

    this.eventBus.emit(EVENTOS.CUENTA_POR_COBRAR_CASTIGADA, {
      tenantId,
      provisionId: provision.id,
      monto: Number(provision.monto).toString(),
    });

    return resultado;
  }
}
