import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeyesFiscalesService } from './leyes-fiscales.service';
import { CrearLeyFiscalDto } from './dto/crear-ley-fiscal.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('leyes-fiscales')
@Controller('leyes-fiscales')
export class LeyesFiscalesController {
  constructor(private readonly leyesFiscalesService: LeyesFiscalesService) {}

  @Post()
  @Permissions('precios.editar')
  crear(@Body() dto: CrearLeyFiscalDto, @CurrentUser() user: JwtPayloadUser) {
    return this.leyesFiscalesService.crear(dto, user.tenantId);
  }

  // Sin permiso más restrictivo que precios.ver a propósito — mismo
  // criterio que CategoriasController: cualquiera que necesite elegir
  // una ley fiscal (formulario de Producto) la tiene.
  @Get()
  @Permissions('precios.ver')
  listar(@Query('activa') activa?: string) {
    return this.leyesFiscalesService.listar(activa === 'true');
  }

  @Patch(':id')
  @Permissions('precios.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearLeyFiscalDto>) {
    return this.leyesFiscalesService.actualizar(id, dto);
  }
}
