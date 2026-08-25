import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VariantesService } from './variantes.service';
import { ActualizarCodigoBarrasDto } from './dto/actualizar-codigo-barras.dto';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiBearerAuth()
@ApiTags('variantes')
@Controller('productos/:productoId/variantes')
export class VariantesController {
  constructor(private readonly variantesService: VariantesService) {}

  @Get()
  @Permissions('precios.ver')
  listar(@Param('productoId') productoId: string, @Query('bodegaId') bodegaId?: string) {
    return this.variantesService.listarPorProducto(productoId, bodegaId);
  }

  @Patch(':varianteId')
  @Permissions('precios.editar')
  actualizarCodigoBarras(
    @Param('productoId') productoId: string,
    @Param('varianteId') varianteId: string,
    @Body() dto: ActualizarCodigoBarrasDto,
  ) {
    return this.variantesService.actualizarCodigoBarras(productoId, varianteId, dto.codigoBarras ?? null);
  }
}
