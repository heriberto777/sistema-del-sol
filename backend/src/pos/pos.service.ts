import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PosRepository } from './pos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { FormasPagoRepository } from '../formas-pago/formas-pago.repository';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { VariantesService } from '../variantes/variantes.service';
import { AbrirTurnoDto } from './dto/abrir-turno.dto';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto';
import { CrearMovimientoCajaDto } from './dto/crear-movimiento-caja.dto';
import { RegistrarVentaPosDto } from './dto/registrar-venta.dto';
import { CotizarVentaPosDto } from './dto/cotizar-venta.dto';
import { GuardarVentaDto } from './dto/guardar-venta.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
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
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly variantesService: VariantesService,
  ) {}

  listarVendedores(busqueda?: string) {
    return this.empleadosRepository.listarVendedores(busqueda);
  }

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

  /**
   * Previsualización sin efectos secundarios (Fase 4c, gap Ofertas+POS —
   * ver ARCHITECTURE.md): el cajero la dispara al abrir el checkout, ANTES
   * de armar los pagos, para ver el total real (ya con ofertas resueltas)
   * en vez del estimado del carrito calculado en el navegador.
   */
  cotizar(dto: CotizarVentaPosDto) {
    return this.facturacionService.cotizar(dto);
  }

  /** Venta rápida de POS: siempre CONTADO, siempre contra la bodega del turno — reutiliza FacturacionService.crear() como Cotizaciones/Remisiones. */
  async registrarVenta(dto: RegistrarVentaPosDto, tenantId: string, cajeroId: string) {
    const turno = await this.posRepository.buscarPorId(dto.turnoCajaId);
    this.validarAbierto(turno);
    // findUniqueOrThrow tenant-scoped: si alguna formaPagoId/vendedorEmpleadoId
    // es de otro tenant, 404 — mismo patrón que InventarioService.validarPertenencia.
    await Promise.all(dto.pagos.map((p) => this.formasPagoRepository.buscarPorId(p.formaPagoId)));
    if (dto.vendedorEmpleadoId) {
      await this.empleadosRepository.buscarPorId(dto.vendedorEmpleadoId);
    }

    return this.facturacionService.crear(
      { clienteId: dto.clienteId, bodegaId: turno.bodegaId, tipoFactura: 'CONTADO', lineas: dto.lineas, listaPrecio: dto.listaPrecio },
      tenantId,
      cajeroId,
      {
        turnoCajaId: dto.turnoCajaId,
        vendedorEmpleadoId: dto.vendedorEmpleadoId,
        pagos: dto.pagos,
      },
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

  /**
   * Devolución parcial (F4) — reusa el mecanismo de Nota de Crédito que ya
   * soporta líneas/cantidades parciales (ver docs/ARCHITECTURE.md), en vez
   * de inventar una tabla de "devolución" propia. La bodega de reintegro es
   * siempre la del turno actual (igual criterio que registrarVenta), no la
   * de la factura original — el reintegro físico ocurre donde está el cajero.
   */
  async registrarDevolucion(dto: RegistrarDevolucionDto, tenantId: string, cajeroId: string) {
    const turno = await this.posRepository.buscarPorId(dto.turnoCajaId);
    this.validarAbierto(turno);
    await this.formasPagoRepository.buscarPorId(dto.formaPagoId);

    const facturaOrigen = await this.facturacionService.buscarPorId(dto.facturaOrigenId);
    this.validarFacturaDevolvible(facturaOrigen);
    const disponiblePorProducto = this.calcularDisponibleParaDevolucion(facturaOrigen);

    const lineas = dto.lineas.map((linea) => {
      const lineaOrigen = facturaOrigen.lineas.find((lo) => lo.productoId === linea.productoId);
      if (!lineaOrigen) {
        throw new BadRequestException(`El producto ${linea.productoId} no pertenece a la factura original`);
      }
      const cantidadOrigen = Number(lineaOrigen.cantidad);
      const disponible = disponiblePorProducto.get(linea.productoId) ?? 0;
      if (linea.cantidad > disponible) {
        throw new BadRequestException(
          `Solo quedan ${disponible} unidad(es) disponibles para devolver de este producto (de ${cantidadOrigen} originales)`,
        );
      }
      // Descuento proporcional a la cantidad devuelta, para que el monto de
      // la nota sea consistente con el descuento que tuvo la línea original.
      const descuentoOriginal = Number(lineaOrigen.descuento);
      const descuento = cantidadOrigen > 0 ? (descuentoOriginal * linea.cantidad) / cantidadOrigen : 0;

      return {
        productoId: linea.productoId,
        varianteId: lineaOrigen.varianteId,
        cantidad: linea.cantidad,
        precioUnitario: Number(lineaOrigen.precioUnitario),
        descuento,
      };
    });

    return this.facturacionService.crear(
      {
        clienteId: facturaOrigen.clienteId,
        bodegaId: turno.bodegaId,
        tipoFactura: 'NOTA_CREDITO',
        facturaOrigenId: dto.facturaOrigenId,
        lineas,
      },
      tenantId,
      cajeroId,
      { formaPagoId: dto.formaPagoId, referenciaPago: dto.referenciaPago, turnoCajaId: dto.turnoCajaId },
    );
  }

  /** Detalle de una factura para armar la Devolución (F4) — cuánto queda disponible por producto, sin exigir `facturacion.ver` (Cajero no lo tiene). */
  async obtenerFacturaParaDevolucion(id: string) {
    const factura = await this.facturacionService.buscarPorId(id);
    this.validarFacturaDevolvible(factura);
    const disponiblePorProducto = this.calcularDisponibleParaDevolucion(factura);

    return {
      id: factura.id,
      ncf: factura.ncf,
      clienteId: factura.clienteId,
      lineas: factura.lineas.map((l) => ({
        productoId: l.productoId,
        nombre: l.producto.nombre,
        codigo: l.producto.codigo,
        cantidadOriginal: Number(l.cantidad),
        disponible: disponiblePorProducto.get(l.productoId) ?? 0,
      })),
    };
  }

  private validarFacturaDevolvible(factura: { estado: string; tipoFactura: string }) {
    if (factura.estado !== 'EMITIDA') {
      throw new BadRequestException('Solo se puede devolver una venta EMITIDA');
    }
    if (factura.tipoFactura === 'NOTA_CREDITO' || factura.tipoFactura === 'NOTA_DEBITO') {
      throw new BadRequestException('No se puede devolver una nota de crédito/débito');
    }
  }

  /**
   * Cuánto de cada producto de `factura` sigue disponible para devolver —
   * cantidad original menos lo ya devuelto por notas de crédito previas
   * (mismo cálculo que FacturacionService.anular() usa para no duplicar el
   * reintegro de inventario).
   */
  private calcularDisponibleParaDevolucion(factura: {
    lineas: { productoId: string; cantidad: unknown }[];
    notasRelacionadas?: { lineas: { productoId: string; cantidad: unknown }[] }[];
  }) {
    const yaDevueltoPorProducto = new Map<string, number>();
    for (const nota of factura.notasRelacionadas ?? []) {
      for (const lineaNota of nota.lineas) {
        yaDevueltoPorProducto.set(
          lineaNota.productoId,
          (yaDevueltoPorProducto.get(lineaNota.productoId) ?? 0) + Number(lineaNota.cantidad),
        );
      }
    }
    const disponiblePorProducto = new Map<string, number>();
    for (const linea of factura.lineas) {
      const cantidadOrigen = Number(linea.cantidad);
      const yaDevuelto = yaDevueltoPorProducto.get(linea.productoId) ?? 0;
      disponiblePorProducto.set(linea.productoId, cantidadOrigen - yaDevuelto);
    }
    return disponiblePorProducto;
  }

  /** Guardar/Guardadas (F12/⇧F12) — aparcar el carrito actual para atender otro cliente sin perderlo. */
  async guardarVenta(turnoId: string, dto: GuardarVentaDto, tenantId: string) {
    const turno = await this.posRepository.buscarPorId(turnoId);
    this.validarAbierto(turno);
    const lineas = await Promise.all(
      dto.lineas.map(async (linea) => ({
        ...linea,
        varianteId: await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId),
      })),
    );
    return this.posRepository.guardarVenta({ tenantId, turnoCajaId: turnoId, ...dto, lineas });
  }

  listarGuardadas(turnoId: string) {
    return this.posRepository.listarGuardadas(turnoId);
  }

  eliminarGuardada(id: string) {
    return this.posRepository.eliminarGuardada(id);
  }

  private validarAbierto(turno: { estado: string }) {
    if (turno.estado !== 'ABIERTO') {
      throw new BadRequestException('Este turno de caja no está abierto');
    }
  }
}
