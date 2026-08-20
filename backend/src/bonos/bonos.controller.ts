import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BonosService } from './bonos.service';
import { EmitirLoteBonosDto } from './dto/emitir-lote-bonos.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiBearerAuth()
@ApiTags('bonos')
@Controller('bonos')
export class BonosController {
  constructor(private readonly bonosService: BonosService) {}

  @Post('lotes')
  @Permissions('bonos.editar')
  emitirLote(@Body() dto: EmitirLoteBonosDto, @CurrentUser() user: JwtPayloadUser) {
    return this.bonosService.emitirLote(dto, user.tenantId);
  }

  @Get()
  @Permissions('bonos.ver')
  listar(@Query('busqueda') busqueda?: string) {
    return this.bonosService.listar(busqueda);
  }

  @Post(':id/anular')
  @Permissions('bonos.editar')
  anular(@Param('id') id: string) {
    return this.bonosService.anular(id);
  }
}
