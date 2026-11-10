import { ForbiddenException, Injectable } from '@nestjs/common';
import { ComentariosDocumentoRepository } from './comentarios-documento.repository';
import { CrearComentarioDocumentoDto } from './dto/crear-comentario-documento.dto';
import { ETIQUETA_TIPO_DOCUMENTO, PERMISO_VER_POR_TIPO_DOCUMENTO } from './tipo-documento';
import { FacturacionService } from '../facturacion/facturacion.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@Injectable()
export class ComentariosDocumentoService {
  constructor(
    private readonly repository: ComentariosDocumentoRepository,
    private readonly facturacionService: FacturacionService,
    private readonly cotizacionesService: CotizacionesService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Resuelve el documento REAL (404 si no es de este tenant — `buscarPorId`
   * de ambos servicios ya es tenant-scoped) y de paso devuelve su
   * etiqueta legible (NCF o número) para notificaciones — `documentoId`
   * es texto libre sin FK (ver el comentario del modelo en schema.prisma),
   * así que esta validación es la única barrera real contra IDOR acá.
   */
  private async resolverDocumento(tipoDocumento: CrearComentarioDocumentoDto['tipoDocumento'], documentoId: string): Promise<string> {
    if (tipoDocumento === 'FACTURA') {
      const factura = await this.facturacionService.buscarPorId(documentoId);
      return factura.ncf ?? '';
    }
    const cotizacion = await this.cotizacionesService.buscarPorId(documentoId);
    return cotizacion.numero;
  }

  private verificarPermisoVer(tipoDocumento: CrearComentarioDocumentoDto['tipoDocumento'], permisos: string[]) {
    const permisoRequerido = PERMISO_VER_POR_TIPO_DOCUMENTO[tipoDocumento];
    if (!permisos.includes(permisoRequerido)) {
      throw new ForbiddenException(`Requiere el permiso: ${permisoRequerido}`);
    }
  }

  async listar(tipoDocumento: CrearComentarioDocumentoDto['tipoDocumento'], documentoId: string, user: JwtPayloadUser) {
    this.verificarPermisoVer(tipoDocumento, user.permisos);
    await this.resolverDocumento(tipoDocumento, documentoId); // 404 si no es de este tenant
    return this.repository.listarPorDocumento(tipoDocumento, documentoId);
  }

  async crear(dto: CrearComentarioDocumentoDto, user: JwtPayloadUser) {
    this.verificarPermisoVer(dto.tipoDocumento, user.permisos);
    const documentoEtiqueta = await this.resolverDocumento(dto.tipoDocumento, dto.documentoId);

    if (dto.mencionadoId) {
      await this.repository.buscarUsuarioPorId(dto.mencionadoId); // 404 si el usuario mencionado no es de este tenant
    }

    const comentario = await this.repository.crear({
      tenantId: user.tenantId,
      tipoDocumento: dto.tipoDocumento,
      documentoId: dto.documentoId,
      autorId: user.userId,
      texto: dto.texto,
      mencionadoId: dto.mencionadoId,
      fechaRecordatorio: dto.fechaRecordatorio ? new Date(dto.fechaRecordatorio) : undefined,
    });

    // No tiene sentido notificarte de tu propio comentario — mismo
    // criterio que TareaProyectoComentadaPayload excluyendo al autor.
    if (dto.mencionadoId && dto.mencionadoId !== user.userId) {
      this.eventBus.emit(EVENTOS.COMENTARIO_DOCUMENTO_MENCION, {
        tenantId: user.tenantId,
        comentarioId: comentario.id,
        autorNombre: comentario.autor.nombre,
        mencionadoId: dto.mencionadoId,
        tipoDocumentoEtiqueta: ETIQUETA_TIPO_DOCUMENTO[dto.tipoDocumento],
        documentoEtiqueta,
        texto: dto.texto,
      });
    }

    return comentario;
  }

  buscarUsuariosMencionables(busqueda?: string) {
    return this.repository.buscarUsuariosMencionables(busqueda);
  }
}
