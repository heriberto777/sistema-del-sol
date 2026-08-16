import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RemisionesService } from './remisiones.service';
import { CrearRemisionDto } from './dto/crear-remision.dto';
import { CambiarEstadoRemisionDto } from './dto/cambiar-estado-remision.dto';
import { ConvertirRemisionDto } from './dto/convertir-remision.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

@ApiBearerAuth()
@ApiTags('remisiones')
@Controller('remisiones')
export class RemisionesController {
  constructor(private readonly remisionesService: RemisionesService) {}

  @Post()
  @Permissions('remisiones.crear')
  crear(@Body() dto: CrearRemisionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.remisionesService.crear(dto, user.tenantId, user.userId);
  }

  @Get()
  @Permissions('remisiones.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.remisionesService.listar(query);
  }

  @Get(':id')
  @Permissions('remisiones.ver')
  buscarPorId(@Param('id') id: string) {
    return this.remisionesService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('remisiones.editar')
  actualizar(@Param('id') id: string, @Body() dto: CrearRemisionDto) {
    return this.remisionesService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permissions('remisiones.editar')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoRemisionDto) {
    return this.remisionesService.cambiarEstado(id, dto.estado);
  }

  @Get(':id/pdf')
  @Permissions('remisiones.ver')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.remisionesService.generarPdf(id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="remision.pdf"' });
    res.send(buffer);
  }

  @Post(':id/convertir')
  @Permissions('remisiones.editar')
  convertir(@Param('id') id: string, @Body() dto: ConvertirRemisionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.remisionesService.convertirEnFactura(id, dto, user.tenantId, user.userId);
  }
}
