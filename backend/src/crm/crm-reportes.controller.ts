import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CrmReportesService } from './crm-reportes.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/reportes')
export class CrmReportesController {
  constructor(private readonly crmReportesService: CrmReportesService) {}

  @Get('dashboard')
  @Permissions('crm.reportes.ver')
  dashboard(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.crmReportesService.dashboard(desde, hasta);
  }
}
