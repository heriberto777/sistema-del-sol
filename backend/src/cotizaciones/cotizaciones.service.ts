import { BadRequestException, Injectable } from '@nestjs/common';
import { CotizacionesRepository } from './cotizaciones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { ClientesService } from '../clientes/clientes.service';
import { VariantesService } from '../variantes/variantes.service';
import { OfertasService } from '../ofertas/ofertas.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { prorratearDescuentoCarrito } from '../ofertas/prorratear-descuento-carrito';
import { CrearCotizacionDto } from './dto/crear-cotizacion.dto';
import { ConvertirCotizacionDto } from './dto/convertir-cotizacion.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { generarDocumentoImpreso, generarPdfPersonalizado } from '../common/pdf/generar-documento-impreso';
import { resolverFormatoImpresion } from '../common/impresion/resolver-formato-impresion';
import { resolverPlantillaDocumento } from '../common/impresion/resolver-plantilla-documento';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FormatoImpresion, PlantillaDocumento } from '@prisma/client';
import { mapearCotizacionAParams } from './mapear-cotizacion-pdf';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';

/**
 * Una cotización vigente cuya fecha de validez ya pasó se marca como
 * vencida sin necesidad de un job que la actualice — pero solo para
 * AVISAR, nunca pisa `estado` (BORRADOR/ENVIADA se quedan como están en
 * la base). Antes sobreescribía `estado: 'VENCIDA'` en la respuesta, lo
 * que hacía que la fila perdiera sus botones de Editar/Enviar/Aceptar/
 * Rechazar en el frontend (que decide qué mostrar mirando `estado`) en
 * cuanto vencía — aunque el backend (`actualizar`/`cambiarEstado`, que
 * leen el estado real vía el repositorio) nunca le puso ningún freno a
 * una cotización vencida: sigue pudiéndose modificar/enviar/aceptar/
 * rechazar hasta que el cliente la apruebe o la rechace (bug real
 * reportado: "vencida" dejaba el documento sin ninguna acción visible).
 */
function marcarVencidaSiAplica<T extends { estado: string; fechaVigenciaHasta: Date }>(cotizacion: T): T & { vencida: boolean } {
  const vencida = (cotizacion.estado === 'BORRADOR' || cotizacion.estado === 'ENVIADA') && cotizacion.fechaVigenciaHasta < new Date();
  return { ...cotizacion, vencida };
}

@Injectable()
export class CotizacionesService {
  constructor(
    private readonly cotizacionesRepository: CotizacionesRepository,
    private readonly facturacionService: FacturacionService,
    private readonly clientesService: ClientesService,
    private readonly variantesService: VariantesService,
    private readonly ofertasService: OfertasService,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly configuracionesService: ConfiguracionesService,
  ) {}

  /**
   * Resuelve ofertas automáticas (Fase 4b) igual que
   * `FacturacionService.crear()` — el usuario decidió que una cotización
   * ya debe mostrar el precio con descuento (no solo al facturarla), así
   * que este es el segundo (de dos) puntos de conexión al motor de
   * ofertas. Remisiones no lo necesita: no tiene precio ni descuento en
   * su modelo (documento sin efecto fiscal, solo cantidades).
   */
  private async calcularLineas(lineas: CrearCotizacionDto['lineas'], listaPrecio: string, tenantId: string) {
    for (const linea of lineas) {
      if (linea.productoId && linea.descripcionManual) {
        throw new BadRequestException('Una línea no puede tener productoId y descripcionManual a la vez');
      }
    }
    // Ítem B-9 — ver el comentario equivalente en
    // FacturacionService.calcularLineasYTotales.
    const tasaItbisGeneralManual = lineas.some((l) => !l.productoId)
      ? Number(await this.configuracionesService.buscarValor('ITBIS_GENERAL', tenantId, CONFIGURACIONES_BASE.ITBIS_GENERAL))
      : 0;

    const lineasCalculadas = await Promise.all(
      lineas.map(async (linea) => {
        if (!linea.productoId) {
          const porcentajeItbis = linea.aplicaItbis === false ? 0 : tasaItbisGeneralManual;
          const precioUnitario = linea.precioUnitario as number;
          const descuento = linea.descuento ?? 0;
          const totalLinea = linea.cantidad * precioUnitario - descuento;
          const montoItbis = totalLinea * (porcentajeItbis / 100);

          return {
            productoId: null,
            varianteId: null,
            descripcionManual: linea.descripcionManual,
            cantidad: linea.cantidad,
            precioUnitario,
            descuento,
            porcentajeItbis,
            montoItbis,
            montoTotal: totalLinea + montoItbis,
          };
        }
        const varianteId = await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId);
        const producto = await this.cotizacionesRepository.obtenerProductoConPrecioVigente(linea.productoId, varianteId, listaPrecio);
        const precioUnitario = linea.precioUnitario ?? Number(producto.precios[0]?.precioVenta ?? 0);
        // Toggle de ITBIS por línea, mismo criterio que FacturacionService —
        // `aplicaItbis: false` fuerza 0% sin importar producto.porcentajeItbis.
        const porcentajeItbis = linea.aplicaItbis === false ? 0 : Number(producto.porcentajeItbis);
        const descuento =
          linea.descuento ?? (await this.ofertasService.resolverDescuentoLinea(linea.productoId, producto.categoriaId, linea.cantidad, precioUnitario));

        const totalLinea = linea.cantidad * precioUnitario - descuento;
        const montoItbis = totalLinea * (porcentajeItbis / 100);

        return {
          productoId: linea.productoId as string | null,
          varianteId: varianteId as string | null,
          descripcionManual: undefined as string | undefined,
          cantidad: linea.cantidad,
          precioUnitario,
          descuento,
          porcentajeItbis,
          montoItbis,
          montoTotal: totalLinea + montoItbis,
        };
      }),
    );

    const subtotalPreCarrito = lineasCalculadas.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario - l.descuento), 0);
    const descuentoCarritoTotal = await this.ofertasService.resolverDescuentoCarritoTotal(subtotalPreCarrito);
    if (descuentoCarritoTotal > 0) {
      const extras = prorratearDescuentoCarrito(
        subtotalPreCarrito,
        lineasCalculadas.map((l) => l.cantidad * l.precioUnitario - l.descuento),
        descuentoCarritoTotal,
      );
      lineasCalculadas.forEach((l, i) => {
        l.descuento += extras[i];
        const totalLinea = l.cantidad * l.precioUnitario - l.descuento;
        l.montoItbis = totalLinea * (l.porcentajeItbis / 100);
        l.montoTotal = totalLinea + l.montoItbis;
      });
    }

    const subtotal = lineasCalculadas.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario - l.descuento), 0);
    const itbis = lineasCalculadas.reduce((acc, l) => acc + l.montoItbis, 0);
    const descuentoTotal = lineasCalculadas.reduce((acc, l) => acc + l.descuento, 0);
    const total = subtotal + itbis;

    return { lineasCalculadas, subtotal, itbis, descuentoTotal, total };
  }

  private async resolverListaPrecio(dto: CrearCotizacionDto) {
    // findUniqueOrThrow tenant-scoped: si clienteId es de otro tenant, 404 —
    // mismo patrón de prevención de IDOR ya documentado para FKs
    // cliente-suministradas. Se valida siempre, incluso con listaPrecio
    // explícito, porque clienteId también se usa para crear la cotización.
    const cliente = await this.clientesService.buscarPorId(dto.clienteId);
    return dto.listaPrecio ?? cliente.listaPrecio?.nombre ?? 'GENERAL';
  }

  async crear(dto: CrearCotizacionDto, tenantId: string, vendedorId: string) {
    const listaPrecio = await this.resolverListaPrecio(dto);
    const { lineasCalculadas, subtotal, itbis, descuentoTotal, total } = await this.calcularLineas(dto.lineas, listaPrecio, tenantId);

    return this.tenantPrisma.client.$transaction(async (tx) => {
      const numero = await this.correlativosRepository.siguienteEnTx(tx, tenantId, 'COTIZACION');
      return this.cotizacionesRepository.crearEnTx(tx, {
        tenantId,
        numero,
        clienteId: dto.clienteId,
        vendedorId,
        fechaVigenciaHasta: new Date(dto.fechaVigenciaHasta),
        subtotal,
        descuento: descuentoTotal,
        itbis,
        total,
        lineas: lineasCalculadas,
      });
    });
  }

  async actualizar(id: string, dto: CrearCotizacionDto, tenantId: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    this.validarQuePuedaEditarse(cotizacion);

    const listaPrecio = await this.resolverListaPrecio(dto);
    const { lineasCalculadas, subtotal, itbis, descuentoTotal, total } = await this.calcularLineas(dto.lineas, listaPrecio, tenantId);

    return this.cotizacionesRepository.actualizar(id, {
      clienteId: dto.clienteId,
      fechaVigenciaHasta: new Date(dto.fechaVigenciaHasta),
      subtotal,
      descuento: descuentoTotal,
      itbis,
      total,
      lineas: lineasCalculadas,
    });
  }

  async buscarPorId(id: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    return marcarVencidaSiAplica(cotizacion);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datosCrudos, total] = await this.cotizacionesRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos: datosCrudos.map(marcarVencidaSiAplica), total, pagina, tamanoPagina };
  }

  /** Dashboard "Resumen ejecutivo" — sin `desde`/`hasta` toma el mes en curso. */
  async resumenConversion(desde?: string, hasta?: string) {
    const hastaFecha = hasta ? new Date(hasta) : new Date();
    const desdeFecha = desde ? new Date(desde) : new Date(hastaFecha.getFullYear(), hastaFecha.getMonth(), 1);
    const { total, convertidas } = await this.cotizacionesRepository.contarParaConversion(desdeFecha, hastaFecha);
    return { cotizaciones: total, convertidas, tasaConversion: total > 0 ? convertidas / total : null };
  }

  async cambiarEstado(id: string, estado: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA', tenantId: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    this.validarQuePuedaEditarse(cotizacion);
    const actualizada = await this.cotizacionesRepository.actualizarEstado(id, estado);

    let avisoNotificacion: string | undefined;
    if (estado === 'ENVIADA') {
      this.eventBus.emit(EVENTOS.COTIZACION_ENVIADA, {
        tenantId,
        cotizacionId: id,
        clienteId: cotizacion.clienteId,
        numero: cotizacion.numero,
        total: cotizacion.total.toString(),
      });
      // El envío real es asíncrono (Event Bus, ver EmailChannel) y nunca
      // bloquea esta respuesta — pero si el cliente no tiene correo
      // registrado, eso SÍ se sabe acá mismo, sin esperar nada. Sin este
      // aviso, el único lugar donde se notaba era el log del servidor
      // (bug real reportado: "le doy enviar y no llega el correo").
      if (!cotizacion.cliente?.email) {
        avisoNotificacion = 'El cliente no tiene un correo registrado — no se envió la cotización por email. Agregale uno en Clientes y volvé a enviarla, o revisá Notificaciones para ver el historial de envíos.';
      }
    }

    return avisoNotificacion ? { ...actualizada, avisoNotificacion } : actualizada;
  }

  /** @deprecated usar generarImpreso — se mantiene por compatibilidad de la ruta /pdf ya existente. */
  async generarPdf(id: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    return generarPdfPersonalizado(this.prisma, cotizacion.tenantId, 'COTIZACION', mapearCotizacionAParams(cotizacion));
  }

  /** Cotización no tiene bodegaId (no toca stock hasta convertirse en factura) — solo aplica el default de tenant. */
  async generarImpreso(id: string, formatoSolicitado: FormatoImpresion | undefined, tenantId: string, plantillaSolicitada?: PlantillaDocumento) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    const [formato, plantilla, personalizacion] = await Promise.all([
      formatoSolicitado ?? resolverFormatoImpresion(this.prisma, tenantId, null),
      plantillaSolicitada ?? resolverPlantillaDocumento(this.prisma, tenantId, null),
      resolverPersonalizacionDocumento(this.prisma, tenantId, 'COTIZACION'),
    ]);
    const { layoutPersonalizado, ...resto } = personalizacion;
    const params = { ...mapearCotizacionAParams(cotizacion), ...resto };
    return generarDocumentoImpreso(params, formato, plantilla, layoutPersonalizado);
  }

  async convertirEnFactura(id: string, dto: ConvertirCotizacionDto, tenantId: string, vendedorId: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(cotizacion);

    const factura = await this.facturacionService.crear(
      {
        clienteId: cotizacion.clienteId,
        bodegaId: dto.bodegaId,
        tipoFactura: dto.tipoFactura,
        lineas: cotizacion.lineas.map((linea) => ({
          productoId: linea.productoId ?? undefined,
          varianteId: linea.varianteId ?? undefined,
          // Ítem B-9 — se propaga tal cual a la factura; el ITBIS de la
          // línea manual se recalcula en FacturacionService.crear() sobre
          // la tasa general vigente (no se snapshotea porcentajeItbis acá,
          // mismo criterio que el resto de la conversión).
          descripcionManual: linea.descripcionManual ?? undefined,
          cantidad: Number(linea.cantidad),
          precioUnitario: Number(linea.precioUnitario),
          descuento: Number(linea.descuento),
          // Si en la cotización esta línea quedó en 0% de ITBIS (toggle
          // apagado al crearla, ítem B-7), se propaga como aplicaItbis:false
          // para que la factura real también salga exenta — sin esto, la
          // exención se perdía al convertir (FacturacionService recalcula
          // su propia tasa y vuelve a cobrar ITBIS sobre una venta que el
          // vendedor había marcado explícitamente como exenta).
          aplicaItbis: Number(linea.porcentajeItbis) === 0 ? false : undefined,
        })),
      },
      tenantId,
      vendedorId,
      { formaPagoId: dto.formaPagoId, referenciaPago: dto.referenciaPago },
    );

    await this.cotizacionesRepository.marcarConvertida(id, factura.id);
    // CRM "Cotización conectada" — si esta cotización está vinculada a una
    // Oportunidad, OportunidadesEventosService la marca Ganada recién acá
    // (no antes): generar/aprobar la cotización no implica haberla cobrado.
    this.eventBus.emit(EVENTOS.COTIZACION_CONVERTIDA_FACTURA, { tenantId, cotizacionId: id, facturaId: factura.id });
    return factura;
  }

  /** Solo usado por convertirEnFactura() — rechazada sigue sin poder convertirse directo; para eso primero hay que revivirla (ver validarQuePuedaEditarse) hasta ACEPTADA. */
  private validarQueSigaAbierta(cotizacion: { estado: string; facturaId: string | null }) {
    if (cotizacion.facturaId) {
      throw new BadRequestException('Esta cotización ya fue convertida en factura');
    }
    if (cotizacion.estado === 'RECHAZADA') {
      throw new BadRequestException('No se puede operar sobre una cotización rechazada');
    }
  }

  /**
   * Usado por actualizar()/cambiarEstado() — decisión explícita del
   * usuario: una cotización se puede editar (líneas/vigencia), enviar y
   * cambiar de estado en CUALQUIER estado, incluida una rechazada (el
   * cliente puede pedir cambios después de decir que no, y eso la revive
   * en vez de obligar a crear una cotización nueva desde cero) — el único
   * estado realmente cerrado es ACEPTADA, porque ahí el cliente ya dio el
   * visto bueno a esos términos exactos y el siguiente paso es
   * convertirla en factura, no seguir negociándola.
   */
  private validarQuePuedaEditarse(cotizacion: { estado: string; facturaId: string | null }) {
    if (cotizacion.facturaId) {
      throw new BadRequestException('Esta cotización ya fue convertida en factura');
    }
    if (cotizacion.estado === 'ACEPTADA') {
      throw new BadRequestException('No se puede modificar una cotización ya aceptada');
    }
  }
}
