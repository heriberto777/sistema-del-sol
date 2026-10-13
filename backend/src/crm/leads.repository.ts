import { Injectable } from '@nestjs/common';
import { Prisma, EstadoLead } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearLeadDto } from './dto/crear-lead.dto';

interface FiltrosLeads {
  skip: number;
  take: number;
  busqueda?: string;
  estado?: EstadoLead;
  vendedorId?: string;
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  crear(dto: CrearLeadDto & { tenantId: string; vendedorId: string }) {
    return this.db.lead.create({ data: dto, include: { vendedor: { select: { id: true, nombre: true } } } });
  }

  async listar({ skip, take, busqueda, estado, vendedorId }: FiltrosLeads) {
    const where: Prisma.LeadWhereInput = {
      ...(estado ? { estado } : {}),
      ...(vendedorId ? { vendedorId } : {}),
      ...(busqueda
        ? {
            OR: [
              { nombre: { contains: busqueda, mode: 'insensitive' as const } },
              { email: { contains: busqueda, mode: 'insensitive' as const } },
              { telefono: { contains: busqueda, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [datos, total] = await Promise.all([
      this.db.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { vendedor: { select: { id: true, nombre: true } } },
        skip,
        take,
      }),
      this.db.lead.count({ where }),
    ]);

    return { datos, total };
  }

  buscarPorId(id: string) {
    return this.db.lead.findUniqueOrThrow({
      where: { id },
      include: { vendedor: { select: { id: true, nombre: true } } },
    });
  }

  actualizar(id: string, dto: Partial<CrearLeadDto>) {
    return this.db.lead.update({ where: { id }, data: dto, include: { vendedor: { select: { id: true, nombre: true } } } });
  }

  cambiarEstado(id: string, estado: EstadoLead, motivoDescarte?: string | null) {
    return this.db.lead.update({ where: { id }, data: { estado, motivoDescarte } });
  }

  /** Valida que un vendedorId pertenezca a ESTE tenant antes de asignarlo — User es tenant-scoped, así que un id de otro tenant tira 404 acá (prevención de IDOR, ver CLAUDE.md). */
  validarVendedorDelTenant(id: string) {
    return this.db.user.findUniqueOrThrow({ where: { id }, select: { id: true } });
  }
}
