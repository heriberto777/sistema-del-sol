import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IaService } from './ia.service';
import { UsoIaService } from './uso-ia.service';
import { PreguntarAsistenteDto } from './dto/preguntar-asistente.dto';
import { SugerirCuentaContableDto } from './dto/sugerir-cuenta-contable.dto';
import { GenerarDescripcionProductoDto } from './dto/generar-descripcion-producto.dto';
import { GenerarDescripcionTareaDto } from './dto/generar-descripcion-tarea.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('ia')
@RequiereModulo('ia')
@Controller('ia')
export class IaController {
  constructor(
    private readonly iaService: IaService,
    private readonly usoIaService: UsoIaService,
  ) {}

  /** Ítem "Auditoría de integraciones" (H-4) — para mostrar "te quedan N de M" antes de generar, no solo enterarse al chocar el límite. */
  @Get('uso-mensual')
  @Permissions('ia.usar')
  async usoMensual() {
    const [imagenProducto, asistente] = await Promise.all([
      this.usoIaService.consultar('IMAGEN_PRODUCTO'),
      this.usoIaService.consultar('ASISTENTE'),
    ]);
    return { imagenProducto, asistente };
  }

  @Post('asistente')
  @Permissions('ia.usar')
  preguntarAsistente(@Body() dto: PreguntarAsistenteDto, @CurrentUser() user: JwtPayloadUser) {
    return this.iaService.preguntarAsistente(dto.pregunta, user.tenantId);
  }

  @Post('sugerir-cuenta-contable')
  @Permissions('ia.usar')
  sugerirCuentaContable(@Body() dto: SugerirCuentaContableDto, @CurrentUser() user: JwtPayloadUser) {
    return this.iaService.sugerirCuentaContable(dto.concepto, user.tenantId);
  }

  @Post('generar-descripcion-producto')
  @Permissions('ia.usar')
  generarDescripcionProducto(@Body() dto: GenerarDescripcionProductoDto, @CurrentUser() user: JwtPayloadUser) {
    return this.iaService.generarDescripcionProducto(dto.nombre, user.tenantId, dto.categoria);
  }

  @Post('generar-descripcion-tarea')
  @Permissions('ia.usar')
  generarDescripcionTarea(@Body() dto: GenerarDescripcionTareaDto, @CurrentUser() user: JwtPayloadUser) {
    return this.iaService.generarDescripcionTarea(dto.titulo, user.tenantId, dto.categoria);
  }
}
