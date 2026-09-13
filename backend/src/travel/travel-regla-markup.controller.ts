import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TipoTravelReserva } from '@prisma/client';
import { TravelReglaMarkupService } from './travel-regla-markup.service';
import { CrearReglaMarkupDto } from './dto/crear-regla-markup.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('travel')
@RequiereModulo('travel')
@Controller('admin/travel/markup')
export class TravelReglaMarkupController {
  constructor(private readonly service: TravelReglaMarkupService) {}

  @Post()
  @Permissions('travel.markup')
  crear(@Body() dto: CrearReglaMarkupDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('travel.markup')
  listar() {
    return this.service.listar();
  }

  // Ruta literal antes de ':id' — cualquiera que pueda crear/reservar necesita esto, no solo quien administra las reglas.
  @Get('sugerir')
  @Permissions('travel.ver')
  sugerir(@Query('tipo') tipo: TipoTravelReserva, @Query('montoCosto') montoCosto: string) {
    return this.service.sugerir(tipo, Number(montoCosto));
  }

  @Patch(':id')
  @Permissions('travel.markup')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearReglaMarkupDto>) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('travel.markup')
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(id);
  }
}
