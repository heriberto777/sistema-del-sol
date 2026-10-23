import { BadRequestException, Body, Controller, Get, Param, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FormatoImpresion, TipoDocumentoImpreso } from '@prisma/client';
import { PersonalizacionDocumentosService } from './personalizacion-documentos.service';
import { CAMPOS_DOCUMENTO } from '../common/pdf/campos-documento';
import { ActualizarPersonalizacionTipoDto } from './dto/actualizar-personalizacion-tipo.dto';
import { ActualizarMarcaDocumentosDto } from './dto/actualizar-marca-documentos.dto';
import { ActualizarLayoutDocumentoDto } from './dto/actualizar-layout-documento.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

const TIPOS_VALIDOS = new Set<string>(Object.values(TipoDocumentoImpreso));

function validarTipo(tipo: string): TipoDocumentoImpreso {
  if (!TIPOS_VALIDOS.has(tipo)) throw new BadRequestException(`Tipo de documento inválido: ${tipo}`);
  return tipo as TipoDocumentoImpreso;
}

@ApiBearerAuth()
@ApiTags('personalizacion-documentos')
@Controller('admin/personalizacion-documentos')
export class PersonalizacionDocumentosController {
  constructor(private readonly service: PersonalizacionDocumentosService) {}

  @Get()
  @Permissions('admin.configuracion')
  listar(@CurrentUser() user: JwtPayloadUser) {
    return this.service.listar(user.tenantId);
  }

  /**
   * "Formato de Documentos" Fase D/E — catálogo de campos individuales
   * insertables en el editor de canvas (bloque "campo"), ver
   * campos-documento.ts. Sin tenantId: es el mismo catálogo fijo para
   * todos. Con `?tipo=`, filtra a los campos que aplican a ESE tipo de
   * documento (Fase F) — sin el query param, devuelve el catálogo
   * completo sin filtrar (compatibilidad).
   */
  @Get('campos-disponibles')
  @Permissions('admin.configuracion')
  camposDisponibles(@Query('tipo') tipo?: string) {
    if (!tipo) return CAMPOS_DOCUMENTO;
    const tipoValido = validarTipo(tipo);
    return CAMPOS_DOCUMENTO.filter((c) => c.tiposDocumento.includes(tipoValido));
  }

  @Put('marca')
  @Permissions('admin.configuracion')
  actualizarMarca(@Body() dto: ActualizarMarcaDocumentosDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.actualizarMarca(user.tenantId, dto);
  }

  @Put(':tipo')
  @Permissions('admin.configuracion')
  actualizarTipo(@Param('tipo') tipo: string, @Body() dto: ActualizarPersonalizacionTipoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.actualizarTipo(user.tenantId, validarTipo(tipo), dto);
  }

  // Fase C — editor de canvas, separado del guardado de la Fase A (actualizarTipo) para no pisar
  // uno al guardar el otro por separado (ver PersonalizacionDocumentosRepository.actualizarLayout).
  @Put(':tipo/layout')
  @Permissions('admin.configuracion')
  actualizarLayout(@Param('tipo') tipo: string, @Body() dto: ActualizarLayoutDocumentoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.actualizarLayout(user.tenantId, validarTipo(tipo), dto.bloques);
  }

  // Fase G — editor básico del ticket térmico (lista ordenada, sin posición libre). Mismo DTO que
  // el layout de Carta/A4 (misma forma `{ bloques: [...] }`, misma validación defensiva al leer).
  @Put(':tipo/layout-termico')
  @Permissions('admin.configuracion')
  actualizarLayoutTermico(@Param('tipo') tipo: string, @Body() dto: ActualizarLayoutDocumentoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.service.actualizarLayoutTermico(user.tenantId, validarTipo(tipo), dto.bloques);
  }

  /** Con `?formato=TERMICA_80MM/58MM`, devuelve el HTML del ticket en vez del PDF — para previsualizar el editor de ticket (Fase G). */
  @Get(':tipo/preview')
  @Permissions('admin.configuracion')
  async preview(@Param('tipo') tipo: string, @Query('formato') formato: FormatoImpresion | undefined, @CurrentUser() user: JwtPayloadUser, @Res() res: Response) {
    const { buffer, contentType } = await this.service.generarPreview(user.tenantId, validarTipo(tipo), formato);
    res.set({ 'Content-Type': contentType, 'Content-Disposition': 'inline; filename="vista-previa"' });
    res.send(buffer);
  }
}
