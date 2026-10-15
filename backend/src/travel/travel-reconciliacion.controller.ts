import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelReconciliacionService } from './travel-reconciliacion.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Reconciliación de la PROPIA cuenta de Duffel del tenant — ya no es un endpoint de Plataforma (ver TravelReconciliacionService). */
@ApiBearerAuth()
@ApiTags('travel')
@RequiereModulo('travel')
@Controller('admin/travel/reconciliacion')
export class TravelReconciliacionController {
  constructor(private readonly service: TravelReconciliacionService) {}

  @Get()
  @Permissions('admin.configuracion')
  reconciliar(@CurrentUser() user: JwtPayloadUser) {
    return this.service.reconciliar(user.tenantId);
  }
}
