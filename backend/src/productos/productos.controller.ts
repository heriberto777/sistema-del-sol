import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ProductosService } from './productos.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { CatalogoQueryDto } from './dto/catalogo-query.dto';
import { ImportarProductosDto } from './dto/importar-productos.dto';
import { AnalizarImagenProductoDto } from './dto/analizar-imagen-producto.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('productos')
@RequiereModulo('productos')
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @Permissions('precios.editar')
  crear(@Body() dto: CrearProductoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.productosService.crear(dto, user.tenantId);
  }

  @Get()
  @Permissions('precios.ver')
  listar(@Query() query: CatalogoQueryDto) {
    return this.productosService.listar(query);
  }

  // Antes de ':id' a propósito — mismo motivo que /clientes/consumidor-final:
  // si no, Nest matchea "catalogo" como si fuera un :id. El árbol de
  // categorías vive en /categorias (CategoriasModule), no acá.
  @Get('catalogo')
  @Permissions('precios.ver')
  catalogo(@Query() query: CatalogoQueryDto) {
    return this.productosService.catalogo(query);
  }

  // Antes de ':id' por el mismo motivo que 'catalogo' arriba.
  @Get('exportar')
  @Permissions('precios.ver')
  async exportar(@Res() res: Response) {
    const archivo = await this.productosService.exportar();
    res.set({
      'Content-Type': archivo.mimeType,
      'Content-Disposition': `attachment; filename="${archivo.nombreArchivo}"`,
      'Content-Length': archivo.buffer.length,
    });
    res.send(archivo.buffer);
  }

  @Post('importar')
  @Permissions('precios.editar')
  importar(@Body() dto: ImportarProductosDto, @CurrentUser() user: JwtPayloadUser) {
    return this.productosService.importar(dto, user.tenantId);
  }

  // Adicional opt-in (nunca en PERMISOS por default de ningún rol) — ver
  // roles-base.ts. Antes de ':id' por el mismo motivo que 'catalogo'/'exportar'.
  @Post('analizar-imagen')
  @Permissions('productos.ia_generar')
  analizarImagen(@Body() dto: AnalizarImagenProductoDto) {
    return this.productosService.analizarImagen(dto.imagen, dto.detalle);
  }

  @Get(':id')
  @Permissions('precios.ver')
  buscarPorId(@Param('id') id: string) {
    return this.productosService.buscarPorId(id);
  }

  @Patch(':id')
  @Permissions('precios.editar')
  actualizar(@Param('id') id: string, @Body() dto: Partial<CrearProductoDto>, @CurrentUser() user: JwtPayloadUser) {
    return this.productosService.actualizar(id, dto, user.tenantId);
  }
}
