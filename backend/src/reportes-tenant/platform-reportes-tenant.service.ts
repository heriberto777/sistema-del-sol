import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformReportesTenantRepository } from './platform-reportes-tenant.repository';
import { ListarReportesTenantQueryDto } from './dto/listar-reportes-tenant-query.dto';
import { CrearMensajeReporteTenantDto } from './dto/crear-mensaje-reporte-tenant.dto';
import { CambiarEstadoReporteTenantDto } from './dto/cambiar-estado-reporte-tenant.dto';
import { esDocumentoTiptapValido } from '../common/tiptap/validar-documento-tiptap';

@Injectable()
export class PlatformReportesTenantService {
  constructor(private readonly repository: PlatformReportesTenantRepository) {}

  listar(query: ListarReportesTenantQueryDto) {
    return this.repository.listar(query);
  }

  buscarPorId(id: string) {
    return this.repository.buscarPorIdOrThrow(id);
  }

  listarMensajes(id: string) {
    return this.repository.listarMensajes(id);
  }

  async agregarMensaje(id: string, dto: CrearMensajeReporteTenantDto, adminId: string) {
    if (!esDocumentoTiptapValido(dto.cuerpo)) {
      throw new BadRequestException('El cuerpo del mensaje tiene un formato inválido.');
    }
    // Primera respuesta del equipo — pasa de NUEVO a EN_REVISION automático
    // (mismo criterio que el modal viejo); cambios de estado posteriores
    // son siempre una acción explícita (`cambiarEstado`), nunca implícita.
    const reporte = await this.repository.buscarPorIdOrThrow(id);
    const nuevoEstado = reporte.estado === 'NUEVO' ? 'EN_REVISION' : undefined;
    return this.repository.agregarMensaje(id, dto, adminId, nuevoEstado);
  }

  cambiarEstado(id: string, dto: CambiarEstadoReporteTenantDto) {
    return this.repository.cambiarEstado(id, dto.estado);
  }

  contarNuevos() {
    return this.repository.contarNuevos();
  }
}
