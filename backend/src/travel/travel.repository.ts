import { Injectable } from '@nestjs/common';
import { EstadoTravelReserva, TipoTravelReserva } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearPasajeroTravelDto } from './dto/crear-pasajero-travel.dto';

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
}
