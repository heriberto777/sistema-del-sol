import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CentrosCostoService } from './centros-costo.service';
import { CrearCentroCostoDto } from './dto/crear-centro-costo.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('centros-costo')
@Controller('centros-costo')
export class CentrosCostoController {
  constructor(private readonly centrosCostoService: CentrosCostoService) {}

  @Post()
  @Permissions('admin.configuracion')
  crear(@Body() dto: CrearCentroCostoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.centrosCostoService.crear(dto, user.tenantId);
  }

  // Sin @Permissions a propósito — mismo criterio que FormasPagoController:
  // catálogo transversal (Gastos Menores, Facturación, Compras, Asiento
  // manual) que necesita cualquiera que registre uno de esos documentos,
  // no solo quien administra el catálogo.
  @Get()
  listar(@Query('activo') activo?: string) {
    return this.centrosCostoService.listar(activo === 'true');
  }

  @Patch(':id')
  @Permissions('admin.configuracion')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearCentroCostoDto>) {
    return this.centrosCostoService.actualizar(id, dto);
  }
}
