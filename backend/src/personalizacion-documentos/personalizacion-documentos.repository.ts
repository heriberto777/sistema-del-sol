import { Injectable } from '@nestjs/common';
import { TipoDocumentoImpreso } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ActualizarPersonalizacionTipoDto } from './dto/actualizar-personalizacion-tipo.dto';

@Injectable()
export class PersonalizacionDocumentosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** `Tenant` no es tenant-scoped (es la tabla raíz) — se filtra por `id` directo, mismo criterio que TenantEmpresaRepository. */
  obtenerMarca(tenantId: string) {
    return this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { colorAcentoDocumentos: true, logo: true } });
  }

  actualizarMarca(tenantId: string, colorAcentoDocumentos: string | null) {
    return this.db.tenant.update({ where: { id: tenantId }, data: { colorAcentoDocumentos }, select: { colorAcentoDocumentos: true } });
  }

  listarTipos(tenantId: string) {
    return this.db.personalizacionDocumentoTipo.findMany({ where: { tenantId } });
  }

  upsertTipo(tenantId: string, tipoDocumento: TipoDocumentoImpreso, dto: ActualizarPersonalizacionTipoDto) {
    const datos = {
      camposEmisorVisibles: dto.camposEmisorVisibles ?? [],
      camposClienteVisibles: dto.camposClienteVisibles ?? [],
      columnasLinea: dto.columnasLinea ?? [],
      totalesVisibles: dto.totalesVisibles ?? [],
      textoLegal: dto.textoLegal || null,
      qrHabilitado: dto.qrHabilitado ?? false,
      qrContenido: dto.qrContenido ?? null,
      qrValor: dto.qrValor || null,
      firmaHabilitada: dto.firmaHabilitada ?? false,
      firmaEtiqueta: dto.firmaEtiqueta || null,
      firmaImagen: dto.firmaImagen || null,
    };
    return this.db.personalizacionDocumentoTipo.upsert({
      where: { tenantId_tipoDocumento: { tenantId, tipoDocumento } },
      create: { tenantId, tipoDocumento, ...datos },
      update: datos,
    });
  }
}
