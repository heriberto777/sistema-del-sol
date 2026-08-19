import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VariantesService } from './variantes.service';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiBearerAuth()
@ApiTags('variantes')
@Controller('productos/:productoId/variantes')
export class VariantesController {
  constructor(private readonly variantesService: VariantesService) {}

  @Get()
  @Permissions('precios.ver')
  listar(@Param('productoId') productoId: string) {
    return this.variantesService.listarPorProducto(productoId);
  }
}
