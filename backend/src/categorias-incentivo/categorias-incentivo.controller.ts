import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriasIncentivoService } from './categorias-incentivo.service';
import { CrearCategoriaIncentivoDto } from './dto/crear-categoria-incentivo.dto';
import { ActualizarCategoriaIncentivoDto } from './dto/actualizar-categoria-incentivo.dto';
import { EnviarResumenIncentivoDto } from './dto/enviar-resumen-incentivo.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

/** Gateado igual que TareasPersonalesController (mismo módulo, 'mistareas'), del que este catálogo depende. Sin `@Permissions` — mismo criterio. */
@ApiBearerAuth()
@ApiTags('categorias-incentivo')
@RequiereModulo('mistareas')
@Controller('admin/categorias-incentivo')
export class CategoriasIncentivoController {
  constructor(private readonly service: CategoriasIncentivoService) {}

  @Post()
  crear(@Body() dto: CrearCategoriaIncentivoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.crear(dto, user.tenantId);
  }

  @Get()
  listar() {
    return this.service.listar();
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarCategoriaIncentivoDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(id);
  }

  @Get('destinatarios')
  listarDestinatarios() {
    return this.service.listarDestinatarios();
  }

  @Get('resumen')
  resumen(@Query('mes') mes: string) {
    return this.service.resumen(mes);
  }

  @Post('resumen/enviar')
  enviarResumen(@Body() dto: EnviarResumenIncentivoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.enviarResumen(dto.mes, dto.canal, dto.destino, user.tenantId, dto.comentario);
  }
}
