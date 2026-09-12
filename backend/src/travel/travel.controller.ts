import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { CrearReservaTravelDto } from './dto/crear-reserva-travel.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('travel')
@RequiereModulo('travel')
@Controller('admin/travel/reservas')
export class TravelController {
  constructor(private readonly travelService: TravelService) {}

  @Post()
  @Permissions('travel.crear')
  crear(@Body() dto: CrearReservaTravelDto, @CurrentUser() user: JwtPayloadUser) {
    return this.travelService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('travel.ver')
  listar() {
    return this.travelService.listar();
  }

  @Get(':id')
  @Permissions('travel.ver')
  buscarPorId(@Param('id') id: string) {
    return this.travelService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('travel.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearReservaTravelDto>) {
    return this.travelService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('travel.eliminar')
  eliminar(@Param('id') id: string) {
    return this.travelService.eliminar(id);
  }

  @Post(':id/facturar')
  @Permissions('travel.facturar')
  facturar(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.travelService.facturar(id, user.tenantId, user.userId);
  }
}
