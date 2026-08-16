import { BadRequestException, Injectable } from '@nestjs/common';
import { CotizacionesRepository } from './cotizaciones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { CrearCotizacionDto } from './dto/crear-cotizacion.dto';
import { ConvertirCotizacionDto } from './dto/convertir-cotizacion.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';

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
    private readonly eventBus: EventBusService,
  ) {}

  private async calcularLineas(lineas: CrearCotizacionDto['lineas']) {
    const lineasCalculadas = await Promise.all(
      lineas.map(async (linea) => {
        const producto = await this.cotizacionesRepository.obtenerProductoConPrecioVigente(linea.productoId);
        const precioUnitario = linea.precioUnitario ?? Number(producto.precios[0]?.precioVenta ?? 0);
        const porcentajeItbis = Number(producto.porcentajeItbis);
        const descuento = linea.descuento ?? 0;

        const totalLinea = linea.cantidad * precioUnitario - descuento;
        const montoItbis = totalLinea * (porcentajeItbis / 100);

        return {
          productoId: linea.productoId,
          cantidad: linea.cantidad,
          precioUnitario,
          descuento,
          porcentajeItbis,
          montoItbis,
          montoTotal: totalLinea + montoItbis,
        };
      }),
    );

    const subtotal = lineasCalculadas.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario - l.descuento), 0);
    const itbis = lineasCalculadas.reduce((acc, l) => acc + l.montoItbis, 0);
    const descuentoTotal = lineasCalculadas.reduce((acc, l) => acc + l.descuento, 0);
    const total = subtotal + itbis;

    return { lineasCalculadas, subtotal, itbis, descuentoTotal, total };
  }

  async crear(dto: CrearCotizacionDto, tenantId: string, vendedorId: string) {
    const { lineasCalculadas, subtotal, itbis, descuentoTotal, total } = await this.calcularLineas(dto.lineas);

    return this.cotizacionesRepository.crear({
      tenantId,
      numero: dto.numero,
      clienteId: dto.clienteId,
      vendedorId,
      fechaVigenciaHasta: new Date(dto.fechaVigenciaHasta),
      subtotal,
      descuento: descuentoTotal,
      itbis,
      total,
      lineas: lineasCalculadas,
    });
  }

  async actualizar(id: string, dto: CrearCotizacionDto) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    if (cotizacion.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede editar una cotización en borrador');
    }

    const { lineasCalculadas, subtotal, itbis, descuentoTotal, total } = await this.calcularLineas(dto.lineas);

    return this.cotizacionesRepository.actualizar(id, {
      numero: dto.numero,
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

  async generarPdf(id: string) {
    const cotizacion = await this.cotizacionesRepository.buscarPorId(id);
    return generarDocumentoPdf({
      tipoDocumento: 'Cotización',
      numero: cotizacion.numero,
      fecha: cotizacion.createdAt,
      cliente: cotizacion.cliente.nombre,
      lineas: cotizacion.lineas.map((linea) => ({
        concepto: linea.producto.nombre,
        cantidad: linea.cantidad.toString(),
        precioUnitario: Number(linea.precioUnitario).toFixed(2),
        total: Number(linea.montoTotal).toFixed(2),
      })),
      subtotal: Number(cotizacion.subtotal),
      descuento: Number(cotizacion.descuento),
      itbis: Number(cotizacion.itbis),
      total: Number(cotizacion.total),
    });
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
          productoId: linea.productoId,
          cantidad: Number(linea.cantidad),
          precioUnitario: Number(linea.precioUnitario),
          descuento: Number(linea.descuento),
        })),
      },
      tenantId,
      vendedorId,
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
