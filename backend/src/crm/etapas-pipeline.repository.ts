import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CrearEtapaPipelineDto } from './dto/crear-etapa-pipeline.dto';

@Injectable()
export class EtapasPipelineRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  contar() {
    return this.db.etapaPipeline.count();
  }

  crear(dto: CrearEtapaPipelineDto, tenantId: string) {
    return this.db.etapaPipeline.create({ data: { ...dto, tenantId } });
  }

  /** Solo usado por EtapasPipelineService.obtenerOSembrar() — los 4 defaults al activar el módulo por primera vez. */
  crearVarias(dtos: (CrearEtapaPipelineDto & { tenantId: string })[]) {
    return this.db.etapaPipeline.createMany({ data: dtos });
  }

  listar() {
    return this.db.etapaPipeline.findMany({ orderBy: { orden: 'asc' } });
  }

  buscarPorId(id: string) {
    return this.db.etapaPipeline.findUniqueOrThrow({ where: { id } });
  }

  actualizar(id: string, dto: Partial<CrearEtapaPipelineDto>) {
    return this.db.etapaPipeline.update({ where: { id }, data: dto });
  }

  eliminar(id: string) {
    return this.db.etapaPipeline.delete({ where: { id } });
  }
}
