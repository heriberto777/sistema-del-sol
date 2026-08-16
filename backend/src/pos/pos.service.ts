import { BadRequestException, Injectable } from '@nestjs/common';
import { PosRepository } from './pos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { AbrirTurnoDto } from './dto/abrir-turno.dto';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto';
import { CrearMovimientoCajaDto } from './dto/crear-movimiento-caja.dto';
import { RegistrarVentaPosDto } from './dto/registrar-venta.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class PosService {
  constructor(
    private readonly posRepository: PosRepository,
    private readonly facturacionService: FacturacionService,
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

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.posRepository.listar({ skip, take });
    return { datos, total, pagina, tamanoPagina };
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

    return this.facturacionService.crear(
      { clienteId: dto.clienteId, bodegaId: turno.bodegaId, tipoFactura: 'CONTADO', lineas: dto.lineas },
      tenantId,
      cajeroId,
      { metodoPago: dto.metodoPago, turnoCajaId: dto.turnoCajaId },
    );
  }

  /** montoEsperado = inicial + ventas en efectivo de este turno + entradas de caja - salidas de caja. */
  async cerrarTurno(id: string, dto: CerrarTurnoDto) {
    const turno = await this.posRepository.buscarPorId(id);
    this.validarAbierto(turno);

    const { ventasEfectivo, entradas, salidas } = await this.posRepository.calcularMovimientoEfectivo(id);
    const montoEsperado = Number(turno.montoInicial) + ventasEfectivo + entradas - salidas;
    const diferencia = dto.montoFinalContado - montoEsperado;

    return this.posRepository.cerrarTurno(id, { montoFinalContado: dto.montoFinalContado, montoEsperado, diferencia });
  }

  private validarAbierto(turno: { estado: string }) {
    if (turno.estado !== 'ABIERTO') {
      throw new BadRequestException('Este turno de caja no está abierto');
    }
  }
}
