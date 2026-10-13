import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MetasVentaService } from './metas-venta.service';
import { CrearMetaVentaDto } from './dto/crear-meta-venta.dto';
import { ListarMetasVentaQueryDto } from './dto/listar-metas-venta-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/metas-venta')
export class MetasVentaController {
  constructor(private readonly metasVentaService: MetasVentaService) {}

  @Get('vendedores')
  @Permissions('crm.metas.configurar')
  listarVendedoresPosibles() {
    return this.metasVentaService.listarVendedoresPosibles();
  }

  @Post()
  @Permissions('crm.metas.configurar')
  crear(@Body() dto: CrearMetaVentaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.metasVentaService.crear(dto, user.tenantId);
  }

  // Sin desde/hasta toma el mes en curso — mismo criterio que CotizacionesService.resumenConversion.
  @Get()
  @Permissions('crm.reportes.ver')
  listarPorPeriodo(@Query() query: ListarMetasVentaQueryDto) {
    const hoy = new Date();
    return this.metasVentaService.listarPorPeriodo(query.anio ?? hoy.getFullYear(), query.mes ?? hoy.getMonth() + 1);
  }

  @Delete(':id')
  @Permissions('crm.metas.configurar')
  eliminar(@Param('id') id: string) {
    return this.metasVentaService.eliminar(id);
  }
}
