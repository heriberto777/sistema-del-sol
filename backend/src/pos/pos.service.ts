import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PosRepository } from './pos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { FormasPagoRepository } from '../formas-pago/formas-pago.repository';
import { AbrirTurnoDto } from './dto/abrir-turno.dto';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto';
import { CrearMovimientoCajaDto } from './dto/crear-movimiento-caja.dto';
import { RegistrarVentaPosDto } from './dto/registrar-venta.dto';
import { ListarTurnosQueryDto } from './dto/listar-turnos-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';

const CLAVE_TOLERANCIA_ARQUEO = 'POS_TOLERANCIA_ARQUEO';

@Injectable()
export class PosService {
  constructor(
    private readonly posRepository: PosRepository,
    private readonly facturacionService: FacturacionService,
    private readonly configuracionesService: ConfiguracionesService,
    private readonly formasPagoRepository: FormasPagoRepository,
  ) {}

  async abrirTurno(dto: AbrirTurnoDto, tenantId: string, cajeroId: string) {
    const turnoAbierto = await this.posRepository.buscarTurnoAbierto(dto.bodegaId);
    if (turnoAbierto) {
      throw new BadRequestException('Esta bodega ya tiene un turno de caja abierto');
    }
    return this.posRepository.crearTurno({ tenantId, bodegaId: dto.bodegaId, cajeroId, montoInicial: dto.montoInicial });
  }

  buscarPorId(id: string) {
    return this.posRepository.buscarPorId(id);
  }

  async listar(query: ListarTurnosQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.posRepository.listar({
      skip,
      take,
      cajeroId: query.cajeroId,
      estado: query.estado,
      desde: query.desde ? new Date(query.desde) : undefined,
      hasta: query.hasta ? new Date(query.hasta) : undefined,
      busqueda: query.busqueda,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  listarCajeros() {
    return this.posRepository.listarCajeros();
  }

  async registrarMovimiento(turnoId: string, dto: CrearMovimientoCajaDto) {
    const turno = await this.posRepository.buscarPorId(turnoId);
    this.validarAbierto(turno);
    return this.posRepository.crearMovimiento({ turnoId, tipo: dto.tipo, monto: dto.monto, concepto: dto.concepto });
  }

  /** Venta rápida de POS: siempre CONTADO, siempre contra la bodega del turno — reutiliza FacturacionService.crear() como Cotizaciones/Remisiones. */
  async registrarVenta(dto: RegistrarVentaPosDto, tenantId: string, cajeroId: string) {
    const turno = await this.posRepository.buscarPorId(dto.turnoCajaId);
    this.validarAbierto(turno);
    // findUniqueOrThrow tenant-scoped: si formaPagoId es de otro tenant, 404 —
    // mismo patrón que InventarioService.validarPertenencia (ver ARCHITECTURE.md).
    await this.formasPagoRepository.buscarPorId(dto.formaPagoId);

    return this.facturacionService.crear(
      { clienteId: dto.clienteId, bodegaId: turno.bodegaId, tipoFactura: 'CONTADO', lineas: dto.lineas },
      tenantId,
      cajeroId,
      { formaPagoId: dto.formaPagoId, referenciaPago: dto.referenciaPago, turnoCajaId: dto.turnoCajaId },
    );
  }

  /**
   * montoEsperado = inicial + ventas en efectivo de este turno + entradas de
   * caja - salidas de caja. Solo el cajero que abrió el turno (o alguien con
   * `pos.supervisar`) puede cerrarlo. Si |diferencia| supera la tolerancia
   * configurada del tenant (`Configuracion.POS_TOLERANCIA_ARQUEO`), exige
   * `justificacionDiferencia`.
   */
  async cerrarTurno(id: string, dto: CerrarTurnoDto, userId: string, tenantId: string, puedeCerrarDeOtros: boolean) {
    const turno = await this.posRepository.buscarPorId(id);
    this.validarAbierto(turno);

    if (turno.cajeroId !== userId && !puedeCerrarDeOtros) {
      throw new ForbiddenException('Solo el cajero que abrió el turno, o un supervisor, puede cerrarlo');
    }

    const { ventasEfectivo, entradas, salidas } = await this.posRepository.calcularMovimientoEfectivo(id);
    const montoEsperado = Number(turno.montoInicial) + ventasEfectivo + entradas - salidas;
    const diferencia = dto.montoFinalContado - montoEsperado;

    const tolerancia = Number(
      await this.configuracionesService.buscarValor(CLAVE_TOLERANCIA_ARQUEO, tenantId, CONFIGURACIONES_BASE.POS_TOLERANCIA_ARQUEO),
    );
    if (Math.abs(diferencia) > tolerancia && !dto.justificacionDiferencia?.trim()) {
      throw new BadRequestException(
        `La diferencia (RD$ ${diferencia.toFixed(2)}) supera la tolerancia configurada (RD$ ${tolerancia.toFixed(2)}) — agregá una justificación para poder cerrar el turno.`,
      );
    }

    return this.posRepository.cerrarTurno(id, {
      montoFinalContado: dto.montoFinalContado,
      montoEsperado,
      diferencia,
      cerradoPorId: userId,
      justificacionDiferencia: dto.justificacionDiferencia,
    });
  }

  private validarAbierto(turno: { estado: string }) {
    if (turno.estado !== 'ABIERTO') {
      throw new BadRequestException('Este turno de caja no está abierto');
    }
  }
}
