import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IaService } from './ia.service';
import { PreguntarAsistenteDto } from './dto/preguntar-asistente.dto';
import { SugerirCuentaContableDto } from './dto/sugerir-cuenta-contable.dto';
import { GenerarDescripcionProductoDto } from './dto/generar-descripcion-producto.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('ia')
@Controller('ia')
export class IaController {
  constructor(private readonly iaService: IaService) {}

  @Post('asistente')
  @Permissions('ia.usar')
  preguntarAsistente(@Body() dto: PreguntarAsistenteDto, @CurrentUser() user: JwtPayloadUser) {
    return this.iaService.preguntarAsistente(dto.pregunta, user.tenantId);
  }

  @Post('sugerir-cuenta-contable')
  @Permissions('ia.usar')
  sugerirCuentaContable(@Body() dto: SugerirCuentaContableDto) {
    return this.iaService.sugerirCuentaContable(dto.concepto);
  }

  @Post('generar-descripcion-producto')
  @Permissions('ia.usar')
  generarDescripcionProducto(@Body() dto: GenerarDescripcionProductoDto) {
    return this.iaService.generarDescripcionProducto(dto.nombre, dto.categoria);
  }
}
