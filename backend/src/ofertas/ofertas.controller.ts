import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OfertasService } from './ofertas.service';
import { CrearOfertaDto } from './dto/crear-oferta.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('ofertas')
@Controller('ofertas')
export class OfertasController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Post()
  @Permissions('ofertas.editar')
  crear(@Body() dto: CrearOfertaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ofertasService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('ofertas.ver')
  listar() {
    return this.ofertasService.listar();
  }

  @Patch(':id')
  @Permissions('ofertas.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearOfertaDto>) {
    return this.ofertasService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('ofertas.editar')
  eliminar(@Param('id') id: string) {
    return this.ofertasService.eliminar(id);
  }
}
