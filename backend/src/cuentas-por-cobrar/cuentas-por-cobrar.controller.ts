import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CuentasPorCobrarService } from './cuentas-por-cobrar.service';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';

/** Ítem Cobranza — listado + antigüedad de facturas CRÉDITO pendientes de cobro (CONTADO se cobra al crear, no aparece acá). */
@ApiBearerAuth()
@ApiTags('cuentas-por-cobrar')
@Controller('cuentas-por-cobrar')
export class CuentasPorCobrarController {
  constructor(private readonly cuentasPorCobrarService: CuentasPorCobrarService) {}

  @Get('resumen')
  @Permissions('cuentasporcobrar.ver')
  resumen() {
    return this.cuentasPorCobrarService.resumen();
  }

  @Get()
  @Permissions('cuentasporcobrar.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.cuentasPorCobrarService.listar(query);
  }
}
