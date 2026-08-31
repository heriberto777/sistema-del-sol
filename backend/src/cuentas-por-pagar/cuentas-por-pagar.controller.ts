import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CuentasPorPagarService } from './cuentas-por-pagar.service';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

/** Ítem Cuentas por Pagar — listado + antigüedad de órdenes de compra pendientes de pago. */
@ApiBearerAuth()
@ApiTags('cuentas-por-pagar')
@RequiereModulo('compras')
@Controller('cuentas-por-pagar')
export class CuentasPorPagarController {
  constructor(private readonly cuentasPorPagarService: CuentasPorPagarService) {}

  @Get('resumen')
  @Permissions('cuentasporpagar.ver')
  resumen() {
    return this.cuentasPorPagarService.resumen();
  }

  @Get()
  @Permissions('cuentasporpagar.ver')
  listar(@Query() query: ListadoQueryDto) {
    return this.cuentasPorPagarService.listar(query);
  }
}
