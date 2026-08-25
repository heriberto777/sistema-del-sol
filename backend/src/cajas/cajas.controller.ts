import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CajasService } from './cajas.service';
import { CrearCajaDto } from './dto/crear-caja.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Ítem E-7 — "Caja" como entidad propia (terminal física de POS), distinta de Bodega y de TurnoCaja. */
@ApiBearerAuth()
@ApiTags('cajas')
@Controller('cajas')
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  @Post()
  @Permissions('pos.supervisar')
  crear(@Body() dto: CrearCajaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.cajasService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('pos.ver')
  listar() {
    return this.cajasService.listar();
  }

  @Get(':id')
  @Permissions('pos.ver')
  buscarPorId(@Param('id') id: string) {
    return this.cajasService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('pos.supervisar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearCajaDto>) {
    return this.cajasService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permissions('pos.supervisar')
  eliminar(@Param('id') id: string) {
    return this.cajasService.eliminar(id);
  }
}
