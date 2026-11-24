import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportesTenantRepository } from './reportes-tenant.repository';
import { CrearReporteTenantDto } from './dto/crear-reporte-tenant.dto';
import { CrearMensajeReporteTenantDto } from './dto/crear-mensaje-reporte-tenant.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { esDocumentoTiptapValido } from '../common/tiptap/validar-documento-tiptap';

@Injectable()
export class ReportesTenantService {
  constructor(private readonly repository: ReportesTenantRepository) {}

  crear(dto: CrearReporteTenantDto, tenantId: string, usuarioId: string) {
    if (!esDocumentoTiptapValido(dto.cuerpo)) {
      throw new BadRequestException('El cuerpo del reporte tiene un formato inválido.');
    }
    return this.repository.crear(dto, tenantId, usuarioId);
  }

  async listarPropios(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.repository.listarPropios({ skip, take });
    return { datos, total, pagina, tamanoPagina };
  }

  listarMensajes(reporteId: string) {
    return this.repository.listarMensajes(reporteId);
  }

  async agregarMensaje(reporteId: string, dto: CrearMensajeReporteTenantDto, usuarioId: string) {
    if (!esDocumentoTiptapValido(dto.cuerpo)) {
      throw new BadRequestException('El cuerpo del mensaje tiene un formato inválido.');
    }
    // Si el ticket estaba RESUELTO, el tenant respondiendo lo reabre a
    // EN_REVISION — el equipo de soporte necesita volver a verlo.
    const reporte = await this.repository.buscarPorIdOrThrow(reporteId);
    const nuevoEstado = reporte.estado === 'RESUELTO' ? 'EN_REVISION' : undefined;
    return this.repository.agregarMensaje(reporteId, dto, usuarioId, nuevoEstado);
  }
}
