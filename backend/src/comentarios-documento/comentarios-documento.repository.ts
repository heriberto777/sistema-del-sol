import { Injectable } from '@nestjs/common';
import { TipoDocumentoComentario } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const AUTOR_MENCIONADO_SELECT = {
  autor: { select: { id: true, nombre: true } },
  mencionado: { select: { id: true, nombre: true } },
} as const;

@Injectable()
export class ComentariosDocumentoRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listarPorDocumento(tipoDocumento: TipoDocumentoComentario, documentoId: string) {
    return this.db.comentarioDocumento.findMany({
      where: { tipoDocumento, documentoId },
      include: AUTOR_MENCIONADO_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  crear(params: {
    tenantId: string;
    tipoDocumento: TipoDocumentoComentario;
    documentoId: string;
    autorId: string;
    texto: string;
    mencionadoId?: string;
    fechaRecordatorio?: Date;
  }) {
    return this.db.comentarioDocumento.create({ data: params, include: AUTOR_MENCIONADO_SELECT });
  }

  /** Para el combobox de "@mencionar" — sin permiso de admin.usuarios (ver ComentariosDocumentoController), cualquier usuario autenticado puede buscar a un compañero. */
  buscarUsuariosMencionables(busqueda?: string) {
    return this.db.user.findMany({
      where: { activo: true, ...(busqueda ? { nombre: { contains: busqueda, mode: 'insensitive' as const } } : {}) },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 10,
    });
  }

  buscarUsuarioPorId(id: string) {
    return this.db.user.findUniqueOrThrow({ where: { id } });
  }
}
