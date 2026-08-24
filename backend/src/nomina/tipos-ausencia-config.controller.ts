import { BadRequestException, Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TipoAusencia } from '@prisma/client';
import { TiposAusenciaConfigService } from './tipos-ausencia-config.service';
import { ActualizarTipoAusenciaConfigDto } from './dto/actualizar-tipo-ausencia-config.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

const TIPOS_VALIDOS: TipoAusencia[] = ['VACACIONES', 'ENFERMEDAD', 'PERMISO', 'INJUSTIFICADA', 'MATERNIDAD_PATERNIDAD', 'OTRO'];

/** Reglas configurables por tipo de ausencia (plan de integración Cuadre, ítem G-2) — catálogo fijo de 6 filas, sembradas al provisionar el tenant, sin crear/eliminar. */
@ApiBearerAuth()
@ApiTags('nomina')
@RequiereModulo('nomina')
@Controller('nomina/tipos-ausencia')
export class TiposAusenciaConfigController {
  constructor(private readonly service: TiposAusenciaConfigService) {}

  @Get()
  @Permissions('rrhh.ver')
  listar() {
    return this.service.listar();
  }

  @Patch(':tipo')
  @Permissions('rrhh.editar')
  actualizar(@Param('tipo') tipo: string, @Body() dto: ActualizarTipoAusenciaConfigDto, @CurrentUser() user: JwtPayloadUser) {
    if (!TIPOS_VALIDOS.includes(tipo as TipoAusencia)) {
      throw new BadRequestException(`Tipo de ausencia inválido: ${tipo}`);
    }
    return this.service.actualizar(tipo as TipoAusencia, user.tenantId, dto);
  }
}
