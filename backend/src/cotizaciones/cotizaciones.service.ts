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
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { generarDocumentoTicketHtml } from '../common/pdf/documento-ticket';
import { resolverFormatoImpresion } from '../common/impresion/resolver-formato-impresion';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FormatoImpresion } from '@prisma/client';
import { mapearCotizacionAParams } from './mapear-cotizacion-pdf';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';
import { CONFIGURACIONES_BASE } from '../tenants/roles-base';

/** Una cotización vigente cuya fecha de validez ya pasó se muestra como vencida sin necesidad de un job que la actualice. */
function marcarVencidaSiAplica<T extends { estado: string; fechaVigenciaHasta: Date }>(cotizacion: T): T {
  if ((cotizacion.estado === 'BORRADOR' || cotizacion.estado === 'ENVIADA') && cotizacion.fechaVigenciaHasta < new Date()) {
    return { ...cotizacion, estado: 'VENCIDA' };
  }
  return cotizacion;
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
          const precioUnitario = linea.precioUnitario as number;
          const descuento = linea.descuento ?? 0;
          const totalLinea = linea.cantidad * precioUnitario - descuento;
          const montoItbis = totalLinea * (tasaItbisGeneralManual / 100);

          return {
            productoId: null,
            varianteId: null,
            descripcionManual: linea.descripcionManual,
            cantidad: linea.cantidad,
            precioUnitario,
            descuento,
            porcentajeItbis: tasaItbisGeneralManual,
            montoItbis,
            montoTotal: totalLinea + montoItbis,
          };
        }
        const varianteId = await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId);
        const producto = await this.cotizacionesRepository.obtenerProductoConPrecioVigente(linea.productoId, varianteId, listaPrecio);
        const precioUnitario = linea.precioUnitario ?? Number(producto.precios[0]?.precioVenta ?? 0);
        const porcentajeItbis = Number(producto.porcentajeItbis);
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
    if (cotizacion.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede editar una cotización en borrador');
    }

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

  async cambiarEstado(id: string, estado: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA', tenantId: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(cotizacion);
    const actualizada = await this.cotizacionesRepository.actualizarEstado(id, estado);

    if (estado === 'ENVIADA') {
      this.eventBus.emit(EVENTOS.COTIZACION_ENVIADA, {
        tenantId,
        cotizacionId: id,
        clienteId: cotizacion.clienteId,
        numero: cotizacion.numero,
        total: cotizacion.total.toString(),
      });
    }

    return actualizada;
  }

  /** @deprecated usar generarImpreso — se mantiene por compatibilidad de la ruta /pdf ya existente. */
  async generarPdf(id: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    return generarDocumentoPdf(mapearCotizacionAParams(cotizacion));
  }

  /** Cotización no tiene bodegaId (no toca stock hasta convertirse en factura) — solo aplica el default de tenant. */
  async generarImpreso(id: string, formatoSolicitado: FormatoImpresion | undefined, tenantId: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    const [formato, personalizacion] = await Promise.all([
      formatoSolicitado ?? resolverFormatoImpresion(this.prisma, tenantId, null),
      resolverPersonalizacionDocumento(this.prisma, tenantId),
    ]);
    const params = { ...mapearCotizacionAParams(cotizacion), ...personalizacion };

    if (formato === 'TERMICA_80MM' || formato === 'TERMICA_58MM') {
      return { buffer: Buffer.from(generarDocumentoTicketHtml(params, formato), 'utf-8'), contentType: 'text/html; charset=utf-8' };
    }
    const buffer = await generarDocumentoPdf(params, { tamanoPagina: formato === 'A4' ? 'a4' : 'letter' });
    return { buffer, contentType: 'application/pdf' };
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
        })),
      },
      tenantId,
      vendedorId,
      { formaPagoId: dto.formaPagoId, referenciaPago: dto.referenciaPago },
    );

    await this.cotizacionesRepository.marcarConvertida(id, factura.id);
    return factura;
  }

  private validarQueSigaAbierta(cotizacion: { estado: string; facturaId: string | null }) {
    if (cotizacion.facturaId) {
      throw new BadRequestException('Esta cotización ya fue convertida en factura');
    }
    if (cotizacion.estado === 'RECHAZADA') {
      throw new BadRequestException('No se puede operar sobre una cotización rechazada');
    }
  }
}
