import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TipoDocumentoComentario } from '@prisma/client';
import { ComentariosDocumentoService } from './comentarios-documento.service';
import { CrearComentarioDocumentoDto } from './dto/crear-comentario-documento.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('comentarios-documento')
@Controller('comentarios-documento')
export class ComentariosDocumentoController {
  constructor(private readonly comentariosDocumentoService: ComentariosDocumentoService) {}

  // Ruta literal declarada ANTES que cualquier eventual ':id' futuro,
  // mismo motivo que 'modalidad'/'requiere-comprobante' en NcfController.
  // SIN @Permissions a propósito: cualquier usuario autenticado del
  // tenant puede buscar a un compañero para @mencionarlo, igual criterio
  // que documentado en ComentariosDocumentoRepository.buscarUsuariosMencionables.
  @Get('usuarios-mencionables')
  usuariosMencionables(@Query('busqueda') busqueda?: string) {
    return this.comentariosDocumentoService.buscarUsuariosMencionables(busqueda);
  }

  // Sin @Permissions a nivel de ruta — el permiso real (ver la Factura/
  // Cotización) depende del `tipoDocumento` del body/query, así que se
  // chequea DENTRO del service (ver verificarPermisoVer).
  @Get()
  listar(
    @Query('tipoDocumento') tipoDocumento: TipoDocumentoComentario,
    @Query('documentoId') documentoId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.comentariosDocumentoService.listar(tipoDocumento, documentoId, user);
  }

  @Post()
  crear(@Body() dto: CrearComentarioDocumentoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.comentariosDocumentoService.crear(dto, user);
  }
}
