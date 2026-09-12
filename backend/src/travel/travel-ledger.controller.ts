import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

/** Saldo del tenant contra el Balance COMPARTIDO de Duffel — ver TravelLedgerMovimiento en el schema para el porqué de este ledger. */
@ApiBearerAuth()
@ApiTags('travel')
@RequiereModulo('travel')
@Controller('admin/travel/ledger')
export class TravelLedgerController {
  constructor(private readonly travelService: TravelService) {}

  @Get()
  @Permissions('travel.ver')
  saldo() {
    return this.travelService.saldoLedger();
  }
}
