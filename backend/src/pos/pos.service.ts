import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PosRepository } from './pos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { FormasPagoRepository } from '../formas-pago/formas-pago.repository';
import { EmpleadosRepository } from '../nomina/empleados.repository';
import { VariantesService } from '../variantes/variantes.service';
import { InventarioService } from '../inventario/inventario.service';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';
import { AbrirTurnoDto } from './dto/abrir-turno.dto';
import { CerrarTurnoDto } from './dto/cerrar-turno.dto';
import { CrearMovimientoCajaDto } from './dto/crear-movimiento-caja.dto';
import { RegistrarVentaPosDto } from './dto/registrar-venta.dto';
import { CotizarVentaPosDto } from './dto/cotizar-venta.dto';
import { GuardarVentaDto } from './dto/guardar-venta.dto';
import { GuardarBorradorCarritoDto } from './dto/guardar-borrador-carrito.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { ListarTurnosQueryDto } from './dto/listar-turnos-query.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';
import { MotivoMovimientoCaja } from '@prisma/client';
import { AutorizacionesService } from '../autorizaciones/autorizaciones.service';
import { CajasService } from '../cajas/cajas.service';

const CLAVE_TOLERANCIA_ARQUEO = 'POS_TOLERANCIA_ARQUEO';

// "Mensaje a cajas" (plan de integración Cuadre, ítem J-3) — broadcast de
// texto a todos los terminales POS. En Redis, no en Postgres: es un aviso
// efímero (turno a turno), no un dato de negocio que necesite historial ni
// aislamiento por sucursal — un TTL largo (8h, una jornada laboral) evita
// que quede "pegado" si alguien olvida borrarlo.
// `turnoCajaId` opcional (ítem "Mensaje a cajas por caja puntual") — sin
// él, cae en la clave de broadcast ('todas'), igual que siempre.
const CLAVE_MENSAJE_CAJAS = (tenantId: string, turnoCajaId?: string) => `pos:mensaje-cajas:${tenantId}:${turnoCajaId ?? 'todas'}`;
const TTL_MENSAJE_CAJAS_SEGUNDOS = 8 * 60 * 60;

/** Ítem "marcar factura devuelta" — mismo criterio que FacturacionService.listar()/buscarParaNota. */
function mapearFacturaTurno<T extends { _count?: { notasRelacionadas: number } }>(factura: T): Omit<T, '_count'> & { tieneNotaAplicada: boolean } {
  const { _count, ...resto } = factura;
  return { ...resto, tieneNotaAplicada: (_count?.notasRelacionadas ?? 0) > 0 };
}

// Plan de integración de brechas Cuadre, ítem F-5: etiqueta legible para
// cuando el cajero deja "concepto" (detalle libre) en blanco.
const ETIQUETA_MOTIVO_MOVIMIENTO: Record<MotivoMovimientoCaja, string> = {
  FONDO_CAMBIO: 'Fondo de cambio',
  DEPOSITO: 'Depósito',
  CORRECCION: 'Corrección',
  OTRO: 'Otro',
};

@Injectable()
export class PosService {
  constructor(
    private readonly posRepository: PosRepository,
    private readonly facturacionService: FacturacionService,
    private readonly configuracionesService: ConfiguracionesService,
    private readonly formasPagoRepository: FormasPagoRepository,
    private readonly empleadosRepository: EmpleadosRepository,
    private readonly variantesService: VariantesService,
    private readonly inventarioService: InventarioService,
    private readonly authService: AuthService,
    private readonly redis: RedisService,
    private readonly autorizacionesService: AutorizacionesService,
    private readonly cajasService: CajasService,
  ) {}

  listarVendedores(busqueda?: string) {
    return this.empleadosRepository.listarVendedores(busqueda);
  }

  /**
   * "Mensaje a cajas" (ítem J-3) — cualquier POS con turno activo lo
   * consulta por polling. Si se pasa `turnoCajaId` y esa caja tiene un
   * mensaje dirigido, gana sobre el broadcast general — si no, cae al
   * de "todas" (mismo comportamiento de siempre para quien no pase
   * `turnoCajaId`, o para una caja sin mensaje propio).
   */
  async obtenerMensajeCajas(tenantId: string, turnoCajaId?: string) {
    if (turnoCajaId) {
      const dirigido = await this.redis.obtenerJson<{ texto: string; fecha: string }>(CLAVE_MENSAJE_CAJAS(tenantId, turnoCajaId));
      if (dirigido) return dirigido;
    }
    const general = await this.redis.obtenerJson<{ texto: string; fecha: string }>(CLAVE_MENSAJE_CAJAS(tenantId));
    return general ?? null;
  }

  async publicarMensajeCajas(tenantId: string, texto: string, turnoCajaId?: string) {
    const mensaje = { texto, fecha: new Date().toISOString() };
    await this.redis.guardarJson(CLAVE_MENSAJE_CAJAS(tenantId, turnoCajaId), mensaje, TTL_MENSAJE_CAJAS_SEGUNDOS);
    return mensaje;
  }

  async borrarMensajeCajas(tenantId: string, turnoCajaId?: string) {
    await this.redis.eliminar(CLAVE_MENSAJE_CAJAS(tenantId, turnoCajaId));
  }

  async abrirTurno(dto: AbrirTurnoDto, tenantId: string, cajeroId: string) {
    // Valida que la bodega pertenezca al tenant (antes ni se chequeaba) y,
    // Fase 9, que el cajero tenga acceso a la sucursal de esa bodega.
    await this.inventarioService.validarAccesoBodega(dto.bodegaId, cajeroId);
    const turnoAbierto = await this.posRepository.buscarTurnoAbierto(dto.bodegaId);
    if (turnoAbierto) {
      throw new BadRequestException('Esta bodega ya tiene un turno de caja abierto');
    }
    // Ítem E-7 — findUniqueOrThrow tenant-scoped (404 si es de otro
    // tenant, mismo patrón de prevención de IDOR ya documentado para FKs
    // cliente-suministradas); además valida que sea una Caja de ESTA
    // bodega, no de otra sucursal.
    if (dto.cajaId) {
      const caja = await this.cajasService.buscarPorId(dto.cajaId);
      if (caja.bodegaId !== dto.bodegaId) {
        throw new BadRequestException('Esa caja no pertenece a la bodega elegida');
      }
    }
    return this.posRepository.crearTurno({ tenantId, bodegaId: dto.bodegaId, cajaId: dto.cajaId, cajeroId, montoInicial: dto.montoInicial });
  }

  async buscarPorId(id: string) {
    const turno = await this.posRepository.buscarPorId(id);
    return { ...turno, facturas: turno.facturas.map(mapearFacturaTurno) };
  }

  /** Ítem "buscador de Devolución" — ver PosRepository.buscarParaDevolver. */
  async buscarParaDevolver(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.posRepository.buscarParaDevolver({ skip, take, busqueda: query.busqueda });
    return { datos: datos.map(mapearFacturaTurno), total, pagina, tamanoPagina };
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

  /** Reporte-dashboard de cierres de caja (ítem E-6) — 4 tiles: total ventas, sobrantes, faltantes, exactas. */
  reporteCierres(query: { desde?: string; hasta?: string; cajeroId?: string; bodegaId?: string }) {
    return this.posRepository.reporteCierres({
      desde: query.desde ? new Date(query.desde) : undefined,
      hasta: query.hasta ? new Date(query.hasta) : undefined,
      cajeroId: query.cajeroId,
      bodegaId: query.bodegaId,
    });
  }

  async registrarMovimiento(turnoId: string, dto: CrearMovimientoCajaDto) {
    const turno = await this.posRepository.buscarPorId(turnoId);
    this.validarAbierto(turno);
    return this.posRepository.crearMovimiento({
      turnoId,
      tipo: dto.tipo,
      monto: dto.monto,
      concepto: dto.concepto?.trim() || ETIQUETA_MOTIVO_MOVIMIENTO[dto.motivoTipo],
      motivoTipo: dto.motivoTipo,
    });
  }

  /**
   * Previsualización sin efectos secundarios (Fase 4c, gap Ofertas+POS —
   * ver ARCHITECTURE.md): el cajero la dispara al abrir el checkout, ANTES
   * de armar los pagos, para ver el total real (ya con ofertas resueltas)
   * en vez del estimado del carrito calculado en el navegador.
   */
  cotizar(dto: CotizarVentaPosDto, tenantId: string) {
    return this.facturacionService.cotizar(dto, tenantId);
  }

  /**
   * Venta rápida de POS, siempre contra la bodega del turno — reutiliza
   * FacturacionService.crear() como Cotizaciones/Remisiones.
   * `tipoFactura` (plan de integración Cuadre, ítem F-2) default CONTADO
   * si se omite — antes de este ítem era siempre CONTADO sin excepción.
   */
  async registrarVenta(dto: RegistrarVentaPosDto, tenantId: string, cajeroId: string) {
    const turno = await this.posRepository.buscarPorId(dto.turnoCajaId);
    this.validarAbierto(turno);
    // Ítem E-7 — solo si el turno abierto tiene una Caja asignada
    // (decisión confirmada con el usuario: la restricción de catálogo es
    // exclusiva del checkout de POS, nunca de Facturación directa).
    if (turno.cajaId) {
      // Ítem B-9 — una línea manual (sin productoId) no tiene catálogo
      // contra qué validar; se excluye de este chequeo.
      const productoIds = dto.lineas.map((l) => l.productoId).filter((id): id is string => !!id);
      await this.cajasService.validarLineasPermitidas(turno.cajaId, productoIds);
    }
    // findUniqueOrThrow tenant-scoped: si alguna formaPagoId/vendedorEmpleadoId
    // es de otro tenant, 404 — mismo patrón que InventarioService.validarPertenencia.
    await Promise.all(dto.pagos.map((p) => this.formasPagoRepository.buscarPorId(p.formaPagoId)));
    if (dto.vendedorEmpleadoId) {
      await this.empleadosRepository.buscarPorId(dto.vendedorEmpleadoId);
    }

    return this.facturacionService.crear(
      {
        clienteId: dto.clienteId,
        bodegaId: turno.bodegaId,
        tipoFactura: dto.tipoFactura ?? 'CONTADO',
        tipoComprobanteEspecial: dto.tipoComprobanteEspecial,
        lineas: dto.lineas,
        listaPrecio: dto.listaPrecio,
      },
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
    const diferenciaExcedeTolerancia = Math.abs(diferencia) > tolerancia;
    if (diferenciaExcedeTolerancia && !dto.justificacionDiferencia?.trim()) {
      throw new BadRequestException(
        `La diferencia (RD$ ${diferencia.toFixed(2)}) supera la tolerancia configurada (RD$ ${tolerancia.toFixed(2)}) — agregá una justificación para poder cerrar el turno.`,
      );
    }

    // Fase 9: PIN de confirmación en los dos momentos sensibles del cierre
    // — diferencia de arqueo fuera de tolerancia, o cierre de un turno
    // ajeno (supervisor cerrando el de otro cajero). No-op si el usuario
    // no tiene PIN configurado (default permisivo).
    if (diferenciaExcedeTolerancia || turno.cajeroId !== userId) {
      await this.authService.verificarPin(userId, dto.pin);
    }

    return this.posRepository.cerrarTurno(id, {
      montoFinalContado: dto.montoFinalContado,
      montoEsperado,
      diferencia,
      cerradoPorId: userId,
      justificacionDiferencia: dto.justificacionDiferencia,
      // Ítem E-6: una diferencia fuera de tolerancia no cierra directo —
      // queda PENDIENTE_REVISION hasta que un supervisor la revise
      // (ver revisarTurno). Dentro de tolerancia, cierra normal como antes.
      estado: diferenciaExcedeTolerancia ? 'PENDIENTE_REVISION' : 'CERRADO',
    });
  }

  /** PENDIENTE_REVISION -> CERRADO (ítem E-6) — un supervisor confirma que ya revisó la diferencia de arqueo. */
  async revisarTurno(id: string, userId: string) {
    const turno = await this.posRepository.buscarPorId(id);
    if (turno.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException('Solo un turno PENDIENTE_REVISION puede marcarse como revisado');
    }
    return this.posRepository.marcarRevisado(id, userId);
  }

  /**
   * Devolución parcial (F4) — reusa el mecanismo de Nota de Crédito que ya
   * soporta líneas/cantidades parciales (ver docs/ARCHITECTURE.md), en vez
   * de inventar una tabla de "devolución" propia. La bodega de reintegro es
   * siempre la del turno actual (igual criterio que registrarVenta), no la
   * de la factura original — el reintegro físico ocurre donde está el cajero.
   */
  /** Ítem D-1 — capa 2 de autorización para devoluciones, mismo mecanismo que FacturacionService.solicitarAutorizacionAnulacion. */
  async solicitarAutorizacionDevolucion(dto: { facturaOrigenId: string; turnoCajaId: string }, userId: string, tenantId: string) {
    const turno = await this.posRepository.buscarPorId(dto.turnoCajaId);
    const bodega = await this.inventarioService.validarAccesoBodega(turno.bodegaId, userId);
    const facturaOrigen = await this.facturacionService.buscarPorId(dto.facturaOrigenId);
    return this.autorizacionesService.solicitar({
      tenantId,
      tipo: 'DEVOLUCION_POS',
      referenciaId: dto.facturaOrigenId,
      sucursalId: bodega.sucursalId,
      solicitadoPorId: userId,
      monto: Number(facturaOrigen.total),
      descripcion: `Devolución de factura ${facturaOrigen.ncf ?? facturaOrigen.id}`,
    });
  }

  async registrarDevolucion(dto: RegistrarDevolucionDto, tenantId: string, cajeroId: string) {
    if (await this.autorizacionesService.estaHabilitada('DEVOLUCION_POS', tenantId)) {
      await this.autorizacionesService.verificar('DEVOLUCION_POS', dto.facturaOrigenId, dto.codigoAutorizacion);
    }

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
        // Ítem B-9 — una línea manual (sin productoId) nunca hace match
        // contra `linea.productoId` (string del DTO), así que `lineaOrigen`
        // llegado a este punto siempre viene de una línea con producto.
        varianteId: lineaOrigen.varianteId!,
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
      // Ítem B-9 — una línea manual no es devolvible por POS (nada que
      // reingresar a inventario, ni un producto contra qué hacer match).
      lineas: factura.lineas
        .filter((l) => l.productoId)
        .map((l) => ({
          productoId: l.productoId as string,
          nombre: l.producto!.nombre,
          codigo: l.producto!.codigo,
          cantidadOriginal: Number(l.cantidad),
          disponible: disponiblePorProducto.get(l.productoId as string) ?? 0,
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
    lineas: { productoId: string | null; cantidad: unknown }[];
    notasRelacionadas?: { lineas: { productoId: string | null; cantidad: unknown }[] }[];
  }) {
    const yaDevueltoPorProducto = new Map<string, number>();
    for (const nota of factura.notasRelacionadas ?? []) {
      for (const lineaNota of nota.lineas) {
        // Ítem B-9 — una línea manual no tiene productoId contra qué acumular.
        if (!lineaNota.productoId) continue;
        yaDevueltoPorProducto.set(
          lineaNota.productoId,
          (yaDevueltoPorProducto.get(lineaNota.productoId) ?? 0) + Number(lineaNota.cantidad),
        );
      }
    }
    const disponiblePorProducto = new Map<string, number>();
    for (const linea of factura.lineas) {
      if (!linea.productoId) continue;
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

  /**
   * Borrador silencioso del carrito activo (no confundir con
   * guardarVenta/F12) — el frontend lo llama debounced en cada cambio del
   * carrito para no perderlo ante un refresh o apagón. Un carrito vacío no
   * tiene nada que proteger: se borra el borrador en vez de guardar uno
   * vacío (invariante forzado acá, no solo confiado al frontend).
   */
  async guardarBorrador(turnoId: string, dto: GuardarBorradorCarritoDto, tenantId: string) {
    const turno = await this.posRepository.buscarPorId(turnoId);
    this.validarAbierto(turno);
    if (dto.lineas.length === 0) {
      await this.posRepository.eliminarBorrador(turnoId);
      return null;
    }
    return this.posRepository.guardarBorrador({ tenantId, turnoCajaId: turnoId, ...dto, lineas: dto.lineas });
  }

  obtenerBorrador(turnoId: string) {
    return this.posRepository.buscarBorrador(turnoId);
  }

  eliminarBorrador(turnoId: string) {
    return this.posRepository.eliminarBorrador(turnoId);
  }

  private validarAbierto(turno: { estado: string }) {
    if (turno.estado !== 'ABIERTO') {
      throw new BadRequestException('Este turno de caja no está abierto');
    }
  }
}
