import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * "El ancla" (CRM "Cotización conectada") — lee Cliente/Lead directo (sin
 * pasar por ClientesService/LeadsService), es una resolución de solo
 * lectura cross-dominio, mismo criterio que ClienteTimelineRepository.
 */
@Injectable()
export class ContactoTelefonoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** Mismo criterio de matcheo (telefono/telefonoSecundario) que LeadsEventosService.alSugerirPedidoWhatsapp. */
  buscarClientePorTelefono(telefono: string) {
    return this.db.cliente.findFirst({
      where: { OR: [{ telefono }, { telefonoSecundario: telefono }] },
      select: { id: true, nombre: true },
    });
  }

  buscarLeadPorTelefono(telefono: string) {
    return this.db.lead.findFirst({
      where: { telefono },
      select: { id: true, nombre: true, estado: true },
    });
  }
}
