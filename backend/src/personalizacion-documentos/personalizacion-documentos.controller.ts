import { BadRequestException, Body, Controller, Get, Param, Put, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TipoDocumentoImpreso } from '@prisma/client';
import { PersonalizacionDocumentosService } from './personalizacion-documentos.service';
import { ActualizarPersonalizacionTipoDto } from './dto/actualizar-personalizacion-tipo.dto';
import { ActualizarMarcaDocumentosDto } from './dto/actualizar-marca-documentos.dto';
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

  @Get(':tipo/preview')
  @Permissions('admin.configuracion')
  async preview(@Param('tipo') tipo: string, @CurrentUser() user: JwtPayloadUser, @Res() res: Response) {
    const buffer = await this.service.generarPreview(user.tenantId, validarTipo(tipo));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="vista-previa.pdf"' });
    res.send(buffer);
  }
}
