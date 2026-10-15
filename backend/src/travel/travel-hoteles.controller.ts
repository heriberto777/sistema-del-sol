import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { BuscarHotelesDto } from './dto/buscar-hoteles.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

/** Búsqueda pura contra el proveedor de hoteles activo — mismo criterio que TravelVuelosController. */
@ApiBearerAuth()
@ApiTags('travel')
@RequiereModulo('travel')
@Controller('admin/travel/hoteles')
export class TravelHotelesController {
  constructor(private readonly travelService: TravelService) {}

  /** Autocompletar de destino — GET porque no muta nada, distinto del POST /buscar que sí dispara la búsqueda de disponibilidad. */
  @Get('destinos')
  @Permissions('travel.buscar')
  destinos(@Query('q') q: string | undefined, @CurrentUser() user: JwtPayloadUser) {
    return this.travelService.buscarDestinosHotel(q ?? '', user.tenantId);
  }

  @Post('buscar')
  @Permissions('travel.buscar')
  buscar(@Body() dto: BuscarHotelesDto, @CurrentUser() user: JwtPayloadUser) {
    return this.travelService.buscarHoteles(dto, user.tenantId);
  }
}
