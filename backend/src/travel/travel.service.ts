import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoTravelReserva } from '@prisma/client';
import { TravelRepository } from './travel.repository';
import { CrearReservaTravelDto } from './dto/crear-reserva-travel.dto';
import { ClientesService } from '../clientes/clientes.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';

const ETIQUETA_TIPO: Record<string, string> = { VUELO: 'Boleto aéreo', HOTEL: 'Reserva de hotel' };

/**
 * Fase 0 de Travel Management — "esqueleto sin proveedor" (ver
 * docs/Sistema_del_Sol_Travel_Management_Plugin.md). CRUD manual de
 * reservas para validar la integración con Cliente/Factura ANTES de
 * tocar la API de Duffel (Fase 1) — a propósito no hay ningún adapter de
 * proveedor acá todavía.
 */
@Injectable()
export class TravelService {
  constructor(
    private readonly repository: TravelRepository,
    private readonly clientesService: ClientesService,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly facturacionService: FacturacionService,
  ) {}

  async crear(dto: CrearReservaTravelDto, tenantId: string) {
    // findFirstOrThrow tenant-scoped: 404 si clienteId es de otro tenant.
    await this.clientesService.buscarPorId(dto.clienteId);

    const numero = await this.correlativosRepository.siguiente(tenantId, 'TRAVEL_RESERVA');
    const codigoInterno = `TRV-${new Date().getFullYear()}-${numero}`;
    const { pasajeros, ...datos } = dto;

    return this.repository.crear({ ...datos, tenantId, codigoInterno }, pasajeros ?? []);
  }

  listar() {
    return this.repository.listar();
  }

  buscarPorId(id: string) {
    return this.repository.buscarPorId(id);
  }

  async actualizar(id: string, dto: Partial<Pick<CrearReservaTravelDto, 'clienteId' | 'tipo' | 'moneda' | 'montoCosto' | 'montoVenta' | 'notas'>> & { estado?: EstadoTravelReserva }) {
    if (dto.clienteId) await this.clientesService.buscarPorId(dto.clienteId);
    return this.repository.actualizar(id, dto);
  }

  async eliminar(id: string) {
    const reserva = await this.repository.buscarPorId(id);
    if (reserva.estado === 'FACTURADA') {
      throw new BadRequestException('No se puede eliminar una reserva ya facturada — anulá la factura primero si corresponde.');
    }
    return this.repository.eliminar(id);
  }

  /**
   * Reserva confirmada → Factura, mismo patrón que
   * ProyectosService.facturarHito (línea con descripcionManual,
   * sinMovimientoInventario: true — un viaje es un SERVICIO, no mueve
   * stock). La conversión de moneda (Pieza Nueva 3 del análisis de Fase
   * 1) todavía no existe — factura solo lo que ya está en DOP, a
   * propósito, para no facturar mal por asumir una tasa de cambio.
   */
  async facturar(id: string, tenantId: string, vendedorId: string) {
    const reserva = await this.repository.buscarPorId(id);
    if (reserva.facturaId) throw new BadRequestException('Esta reserva ya fue facturada');
    if (reserva.estado === 'CANCELADA') throw new BadRequestException('No se puede facturar una reserva cancelada');
    if (reserva.moneda !== 'DOP') {
      throw new BadRequestException(`Facturar en ${reserva.moneda} todavía no está soportado — la conversión de moneda es una pieza pendiente. Facturá en DOP por ahora.`);
    }

    const bodega = await this.repository.buscarBodegaActivaPorDefecto();
    if (!bodega) throw new BadRequestException('Este tenant no tiene ninguna bodega activa configurada — no se puede facturar');

    const factura = await this.facturacionService.crear(
      {
        clienteId: reserva.clienteId,
        bodegaId: bodega.id,
        tipoFactura: 'CONTADO',
        lineas: [
          {
            descripcionManual: `${ETIQUETA_TIPO[reserva.tipo]} — ${reserva.codigoInterno}`,
            cantidad: 1,
            precioUnitario: Number(reserva.montoVenta),
            aplicaItbis: true,
          },
        ],
      },
      tenantId,
      vendedorId,
      { sinMovimientoInventario: true },
    );

    await this.repository.marcarFacturada(id, factura.id);
    return { facturaId: factura.id, numero: factura.numero, total: factura.total };
  }
}
