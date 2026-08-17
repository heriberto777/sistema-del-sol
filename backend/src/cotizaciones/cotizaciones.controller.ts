import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CotizacionesService } from './cotizaciones.service';
import { CrearCotizacionDto } from './dto/crear-cotizacion.dto';
import { CambiarEstadoCotizacionDto } from './dto/cambiar-estado-cotizacion.dto';
import { ConvertirCotizacionDto } from './dto/convertir-cotizacion.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('cotizaciones')
@RequiereModulo('cotizaciones')
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post()
  @Permissions('cotizaciones.crear')
  crear(@Body() dto: CrearCotizacionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cotizacionesService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('cotizaciones.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.cotizacionesService.listar(query);
  }

  @Get(':id')
  @Permissions('cotizaciones.ver')
  buscarPorId(@Param('id') id: string) {
    return this.cotizacionesService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('cotizaciones.editar')
  actualizar(@Param('id') id: string, @Body() dto: CrearCotizacionDto) {
    return this.cotizacionesService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permissions('cotizaciones.editar')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoCotizacionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cotizacionesService.cambiarEstado(id, dto.estado, user.tenantId);
  }

  @Get(':id/pdf')
  @Permissions('cotizaciones.ver')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.cotizacionesService.generarPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="cotizacion.pdf"' });
    res.send(buffer);
  }

  @Post(':id/convertir')
  @Permissions('cotizaciones.editar')
  convertir(@Param('id') id: string, @Body() dto: ConvertirCotizacionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cotizacionesService.convertirEnFactura(id, dto, user.tenantId, user.userId);
  }
}
