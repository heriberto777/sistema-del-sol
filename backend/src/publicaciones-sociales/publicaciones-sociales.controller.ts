import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PublicacionesSocialesService } from './publicaciones-sociales.service';
import { CrearPublicacionSocialDto } from './dto/crear-publicacion-social.dto';
import { CambiarEstadoPublicacionSocialDto } from './dto/cambiar-estado-publicacion-social.dto';
import { EnviarWhatsappPublicacionSocialDto } from './dto/enviar-whatsapp-publicacion-social.dto';
import { ListarPublicacionesSocialesQueryDto } from './dto/listar-publicaciones-sociales-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('publicaciones-sociales')
@RequiereModulo('publicacionessociales')
@Controller('admin/publicaciones-sociales')
export class PublicacionesSocialesController {
  constructor(private readonly publicacionesSocialesService: PublicacionesSocialesService) {}

  @Post()
  @Permissions('publicacionessociales.crear')
  crear(@Body() dto: CrearPublicacionSocialDto, @CurrentUser() user: JwtPayloadUser) {
    return this.publicacionesSocialesService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('publicacionessociales.ver')
  listar(@Query() query: ListarPublicacionesSocialesQueryDto) {
    return this.publicacionesSocialesService.listar(query);
  }

  // Ruta literal antes de ':id' a propósito (mismo cuidado de orden que ProyectosController).
  @Get('plantillas')
  @Permissions('publicacionessociales.ver')
  listarPlantillas() {
    return this.publicacionesSocialesService.listarPlantillas();
  }

  @Get(':id')
  @Permissions('publicacionessociales.ver')
  buscarPorId(@Param('id') id: string) {
    return this.publicacionesSocialesService.buscarPorId(id);
  }

  @Patch(':id/enviar-aprobacion')
  @Permissions('publicacionessociales.editar')
  enviarAAprobacion(@Param('id') id: string) {
    return this.publicacionesSocialesService.enviarAAprobacion(id);
  }

  @Patch(':id/estado')
  @Permissions('publicacionessociales.aprobar')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoPublicacionSocialDto, @CurrentUser() user: JwtPayloadUser) {
    return this.publicacionesSocialesService.cambiarEstado(id, dto.estado, user.userId, dto.motivoRechazo);
  }

  @Post(':id/enviar-whatsapp')
  @Permissions('publicacionessociales.editar')
  enviarPorWhatsapp(@Param('id') id: string, @Body() dto: EnviarWhatsappPublicacionSocialDto, @CurrentUser() user: JwtPayloadUser) {
    return this.publicacionesSocialesService.enviarPorWhatsapp(id, dto.telefono, user.tenantId);
  }
}
