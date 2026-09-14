import { Injectable } from '@nestjs/common';
import { EstadoTravelReserva, TipoMovimientoLedgerTravel, TipoTravelReserva } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearPasajeroTravelDto } from './dto/crear-pasajero-travel.dto';
import { PasajeroOrdenVuelo } from './providers/travel-provider.interface';
import { HuespedReservaHotel } from './providers/hotel-provider.interface';

const INCLUDE_RESERVA = {
  cliente: { select: { id: true, nombre: true } },
  pasajeros: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class TravelRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(
    datos: {
      tenantId: string;
      codigoInterno: string;
      clienteId: string;
      tipo: TipoTravelReserva;
      moneda?: string;
      montoCosto: number;
      montoVenta: number;
      notas?: string;
    },
    pasajeros: CrearPasajeroTravelDto[],
  ) {
    return this.db.travelReserva.create({
      data: { ...datos, pasajeros: { create: pasajeros.map((p) => ({ ...p, fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : undefined })) } },
      include: INCLUDE_RESERVA,
    });
  }

  listar() {
    return this.db.travelReserva.findMany({ include: INCLUDE_RESERVA, orderBy: { createdAt: 'desc' } });
  }

  buscarPorId(id: string) {
    return this.db.travelReserva.findFirstOrThrow({ where: { id }, include: INCLUDE_RESERVA });
  }

  actualizar(
    id: string,
    datos: Partial<{
      clienteId: string;
      tipo: TipoTravelReserva;
      estado: EstadoTravelReserva;
      moneda: string;
      montoCosto: number;
      montoVenta: number;
      notas: string;
    }>,
  ) {
    return this.db.travelReserva.update({ where: { id }, data: datos, include: INCLUDE_RESERVA });
  }

  marcarFacturada(id: string, facturaId: string) {
    return this.db.travelReserva.update({ where: { id }, data: { estado: 'FACTURADA', facturaId } });
  }

  eliminar(id: string) {
    return this.db.travelReserva.delete({ where: { id } });
  }

  /** Mismo criterio que ProyectosRepository.buscarBodegaActivaPorDefecto — una reserva es un SERVICIO, no mueve stock, pero FacturacionService.crear() igual exige una bodega. */
  buscarBodegaActivaPorDefecto() {
    return this.db.bodega.findFirst({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  /**
   * Fase 1b — reserva creada de verdad contra un proveedor (Duffel), a
   * diferencia de `crear()` que es la carga manual de Fase 0. Separado a
   * propósito: los campos de proveedor (montoCosto/moneda ya re-priced,
   * ids de Duffel) nunca deberían poder colarse en el alta manual.
   */
  crearDesdeProveedor(
    datos: {
      tenantId: string;
      codigoInterno: string;
      clienteId: string;
      tipo: TipoTravelReserva;
      estado: EstadoTravelReserva;
      moneda: string;
      montoCosto: number;
      montoVenta: number;
      notas?: string;
      proveedor: string;
      proveedorOfertaId: string;
      proveedorOrdenId: string;
      localizadorAerolinea: string;
    },
    pasajeros: PasajeroOrdenVuelo[],
  ) {
    return this.db.travelReserva.create({
      data: {
        ...datos,
        pasajeros: {
          create: pasajeros.map((p) => ({
            nombre: p.nombre,
            apellido: p.apellido,
            fechaNacimiento: new Date(p.fechaNacimiento),
            email: p.email,
            telefono: p.telefono,
            // Pasaporte (APIS) — se guarda para trazabilidad aunque Duffel no lo devuelva en la respuesta de la orden.
            ...(p.numeroPasaporte
              ? {
                  tipoDocumento: 'passport',
                  numeroDocumento: p.numeroPasaporte,
                  paisEmisionDocumento: p.paisEmisionPasaporte,
                  fechaVencimientoDocumento: p.fechaVencimientoPasaporte ? new Date(p.fechaVencimientoPasaporte) : undefined,
                }
              : {}),
          })),
        },
      },
      include: INCLUDE_RESERVA,
    });
  }

  /**
   * Hoteles (Hotelbeds) — hermano de crearDesdeProveedor (vuelos). No lo
   * reusa: los huéspedes solo tienen nombre/apellido/tipo (AD/CH), a
   * diferencia de un pasajero de vuelo (pasaporte, título, etc.) — forzar
   * el mismo tipo hubiera sido más confuso que un método aparte.
   */
  crearDesdeProveedorHotel(
    datos: {
      tenantId: string;
      codigoInterno: string;
      clienteId: string;
      estado: EstadoTravelReserva;
      moneda: string;
      montoCosto: number;
      montoVenta: number;
      notas?: string;
      proveedor: string;
      proveedorOfertaId: string;
      proveedorOrdenId: string;
      localizadorAerolinea: string;
    },
    huespedes: HuespedReservaHotel[],
  ) {
    return this.db.travelReserva.create({
      data: {
        ...datos,
        tipo: 'HOTEL',
        // Nunca en tipoDocumento (es "passport", etc. — otro concepto). El
        // tipo AD/CH del huésped solo hace falta para la request a
        // Hotelbeds, no se persiste todavía.
        pasajeros: { create: huespedes.map((h) => ({ nombre: h.nombre, apellido: h.apellido })) },
      },
      include: INCLUDE_RESERVA,
    });
  }

  marcarCancelacionCotizada(id: string, proveedorCancelacionId: string) {
    return this.db.travelReserva.update({ where: { id }, data: { proveedorCancelacionId } });
  }

  marcarCanceladaPorProveedor(id: string) {
    return this.db.travelReserva.update({ where: { id }, data: { estado: 'CANCELADA' } });
  }

  descartarAlertaProveedor(id: string) {
    return this.db.travelReserva.update({
      where: { id },
      data: { alertaProveedorTipo: null, alertaProveedorDetalle: null, alertaProveedorEn: null },
    });
  }

  registrarMovimientoLedger(datos: {
    tenantId: string;
    reservaId?: string;
    tipo: TipoMovimientoLedgerTravel;
    monto: number;
    moneda: string;
    descripcion: string;
  }) {
    return this.db.travelLedgerMovimiento.create({ data: datos });
  }

  listarLedger() {
    return this.db.travelLedgerMovimiento.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async resumen() {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [porEstadoRaw, ingresosMes, pendientesDeFacturar] = await Promise.all([
      this.db.travelReserva.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.db.travelReserva.aggregate({ _sum: { montoVenta: true }, where: { estado: 'FACTURADA', updatedAt: { gte: inicioMes } } }),
      this.db.travelReserva.count({ where: { estado: 'CONFIRMADA' } }),
    ]);

    return {
      reservasPorEstado: Object.fromEntries(porEstadoRaw.map((r) => [r.estado, r._count._all])),
      ingresosMes: Number(ingresosMes._sum.montoVenta ?? 0),
      pendientesDeFacturar,
    };
  }
}
