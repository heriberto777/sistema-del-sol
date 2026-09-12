import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoTravelReserva } from '@prisma/client';
import { TravelRepository } from './travel.repository';
import { CrearReservaTravelDto } from './dto/crear-reserva-travel.dto';
import { BuscarVuelosDto } from './dto/buscar-vuelos.dto';
import { ReservarOfertaVueloDto } from './dto/reservar-oferta-vuelo.dto';
import { ClientesService } from '../clientes/clientes.service';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { TasasCambioService } from '../tasas-cambio/tasas-cambio.service';
import { TravelProviderService } from './providers/travel-provider.service';

const ETIQUETA_TIPO: Record<string, string> = { VUELO: 'Boleto aéreo', HOTEL: 'Reserva de hotel' };

/**
 * Fase 0 (esqueleto sin proveedor, carga manual) + Fase 1b (búsqueda/
 * reserva/cancelación reales vía TravelProviderService — ver
 * docs/Sistema_del_Sol_Travel_Management_Plugin.md). Las dos rutas de
 * alta conviven: `crear()` para cargar a mano (reserva hecha por fuera
 * del sistema), `reservarOfertaVuelo()` para reservar de verdad contra
 * el proveedor activo (Duffel) — nunca se mezclan los campos de una
 * con la otra (ver TravelRepository.crear vs. crearDesdeProveedor).
 */
@Injectable()
export class TravelService {
  constructor(
    private readonly repository: TravelRepository,
    private readonly clientesService: ClientesService,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly facturacionService: FacturacionService,
    private readonly travelProviderService: TravelProviderService,
    private readonly tasasCambioService: TasasCambioService,
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
   * stock). Conversión de moneda: reusa la tasa que el tenant ya
   * configura en Configuración → Tasas de cambio (mismo catálogo que usa
   * el ítem C-2 de Facturación) — `tasa` es "cuántos DOP vale 1 unidad de
   * esa moneda" (ver TasasCambioService), así que `montoVenta * tasa` da
   * el monto DOP real a facturar. Se pasa además `moneda` a
   * FacturacionService.crear() para que el documento impreso muestre
   * también el monto original vía el mecanismo de multi-moneda que ya
   * existe (subtotalMoneda/totalMoneda) — no se inventa nada nuevo.
   */
  async facturar(id: string, tenantId: string, vendedorId: string) {
    const reserva = await this.repository.buscarPorId(id);
    if (reserva.facturaId) throw new BadRequestException('Esta reserva ya fue facturada');
    if (reserva.estado === 'CANCELADA') throw new BadRequestException('No se puede facturar una reserva cancelada');

    let precioUnitarioDop = Number(reserva.montoVenta);
    if (reserva.moneda !== 'DOP') {
      const tasaCambio = await this.tasasCambioService.buscarPorMoneda(reserva.moneda);
      if (!tasaCambio) {
        throw new BadRequestException(
          `No hay una tasa de cambio configurada para ${reserva.moneda} — configurala en Configuración → Tasas de cambio antes de facturar esta reserva.`,
        );
      }
      // Redondeo a 2 decimales — mismo criterio que costo-hora.util (evitar ruido de punto flotante en el monto final).
      precioUnitarioDop = Math.round(Number(reserva.montoVenta) * Number(tasaCambio.tasa) * 100) / 100;
    }

    const bodega = await this.repository.buscarBodegaActivaPorDefecto();
    if (!bodega) throw new BadRequestException('Este tenant no tiene ninguna bodega activa configurada — no se puede facturar');

    const factura = await this.facturacionService.crear(
      {
        clienteId: reserva.clienteId,
        bodegaId: bodega.id,
        tipoFactura: 'CONTADO',
        moneda: reserva.moneda !== 'DOP' ? reserva.moneda : undefined,
        lineas: [
          {
            descripcionManual: `${ETIQUETA_TIPO[reserva.tipo]} — ${reserva.codigoInterno}`,
            cantidad: 1,
            precioUnitario: precioUnitarioDop,
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

  buscarVuelos(dto: BuscarVuelosDto) {
    return this.travelProviderService.activo.buscarVuelos(dto);
  }

  /**
   * Reserva de verdad contra el proveedor activo — re-price obligatorio
   * (nunca se confía en el precio que vio el usuario al buscar, puede
   * haber cambiado o expirado) y pago siempre vía Balance compartido de
   * la plataforma (nunca tarjeta — ver "Los Dos Pagos del Vuelo"). El
   * débito contra ese Balance queda registrado en el ledger interno para
   * saber cuánto le corresponde a este tenant.
   */
  async reservarOfertaVuelo(dto: ReservarOfertaVueloDto, tenantId: string) {
    await this.clientesService.buscarPorId(dto.clienteId);

    const proveedor = this.travelProviderService.activo;
    const oferta = await proveedor.obtenerOferta(dto.ofertaId);
    if (new Date(oferta.expiraEn) < new Date()) {
      throw new BadRequestException('Esta oferta ya expiró — hay que buscar de nuevo.');
    }

    const orden = await proveedor.crearOrdenVuelo({
      ofertaId: oferta.id,
      pasajeros: dto.pasajeros,
      montoBalance: Number(oferta.montoTotal),
      monedaBalance: oferta.moneda,
    });

    const numero = await this.correlativosRepository.siguiente(tenantId, 'TRAVEL_RESERVA');
    const codigoInterno = `TRV-${new Date().getFullYear()}-${numero}`;

    const reserva = await this.repository.crearDesdeProveedor(
      {
        tenantId,
        codigoInterno,
        clienteId: dto.clienteId,
        tipo: 'VUELO',
        estado: 'CONFIRMADA',
        moneda: oferta.moneda,
        montoCosto: Number(oferta.montoTotal),
        montoVenta: dto.montoVenta,
        notas: dto.notas,
        proveedor: proveedor.clave,
        proveedorOfertaId: oferta.id,
        proveedorOrdenId: orden.id,
        localizadorAerolinea: orden.localizador,
      },
      dto.pasajeros,
    );

    await this.repository.registrarMovimientoLedger({
      tenantId,
      reservaId: reserva.id,
      tipo: 'DEBITO',
      monto: Number(oferta.montoTotal),
      moneda: oferta.moneda,
      descripcion: `Orden ${proveedor.clave} ${orden.id} — ${reserva.codigoInterno}`,
    });

    return reserva;
  }

  /** Paso 1 de 2 — cotiza el reembolso sin cancelar todavía. */
  async cotizarCancelacionProveedor(id: string) {
    const reserva = await this.repository.buscarPorId(id);
    if (!reserva.proveedorOrdenId) {
      throw new BadRequestException('Esta reserva no fue hecha contra un proveedor — no hay una orden que cancelar (usá eliminar si es carga manual).');
    }
    const cotizacion = await this.travelProviderService.activo.cotizarCancelacion(reserva.proveedorOrdenId);
    await this.repository.marcarCancelacionCotizada(id, cotizacion.id);
    return cotizacion;
  }

  /** Paso 2 de 2 — confirma la cancelación cotizada y acredita el reembolso al ledger del tenant. */
  async confirmarCancelacionProveedor(id: string, tenantId: string) {
    const reserva = await this.repository.buscarPorId(id);
    if (!reserva.proveedorCancelacionId) {
      throw new BadRequestException('Primero hay que cotizar la cancelación (cotizarCancelacionProveedor).');
    }

    const resultado = await this.travelProviderService.activo.confirmarCancelacion(reserva.proveedorCancelacionId);
    await this.repository.marcarCanceladaPorProveedor(id);

    if (resultado.reembolsado && resultado.montoReembolso) {
      await this.repository.registrarMovimientoLedger({
        tenantId,
        reservaId: id,
        tipo: 'CREDITO',
        monto: Number(resultado.montoReembolso),
        moneda: resultado.moneda ?? reserva.moneda,
        descripcion: `Reembolso cancelación ${reserva.codigoInterno}`,
      });
    }

    return resultado;
  }

  /** Saldo (CREDITO - DEBITO) del tenant contra el Balance compartido de la plataforma, agrupado por moneda — sin cachear, bajo volumen esperado en esta fase. */
  async saldoLedger() {
    const movimientos = await this.repository.listarLedger();
    const saldos = new Map<string, number>();
    for (const m of movimientos) {
      const signo = m.tipo === 'CREDITO' ? 1 : -1;
      saldos.set(m.moneda, (saldos.get(m.moneda) ?? 0) + signo * Number(m.monto));
    }
    return [...saldos.entries()].map(([moneda, saldo]) => ({ moneda, saldo }));
  }
}
