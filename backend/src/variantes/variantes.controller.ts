import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VariantesService } from './variantes.service';
import { ActualizarCodigoBarrasDto } from './dto/actualizar-codigo-barras.dto';
import { GenerarCodigoBarrasDto } from './dto/generar-codigo-barras.dto';
import { BuscarVariantesQueryDto } from './dto/buscar-variantes-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

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

  @Post(':varianteId/codigo-barras/generar')
  @Permissions('precios.editar')
  generarCodigoBarras(
    @Param('productoId') productoId: string,
    @Param('varianteId') varianteId: string,
    @Body() dto: GenerarCodigoBarrasDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.variantesService.generarCodigoBarras(productoId, varianteId, dto.formato, user.tenantId);
  }
}

/**
 * Búsqueda de variantes a través de TODO el catálogo (no acotada a un
 * producto) — controller aparte de `VariantesController` porque ese vive
 * anidado bajo `productos/:productoId/variantes`, y esta ruta no tiene
 * ningún `productoId` en el path. Usada por la pantalla de impresión
 * masiva de etiquetas (`EtiquetasCodigoBarras.tsx`).
 */
@ApiBearerAuth()
@ApiTags('variantes')
@Controller('productos/variantes')
export class VariantesBusquedaController {
  constructor(private readonly variantesService: VariantesService) {}

  @Get('buscar')
  @Permissions('precios.ver')
  buscar(@Query() query: BuscarVariantesQueryDto) {
    return this.variantesService.buscarEnCatalogo(query);
  }
}
