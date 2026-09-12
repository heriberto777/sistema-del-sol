import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { BuscarVuelosDto } from './dto/buscar-vuelos.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

/** Búsqueda pura contra el proveedor activo — no toca ninguna tabla propia, por eso vive aparte de TravelController (que sí administra TravelReserva). */
@ApiBearerAuth()
@ApiTags('travel')
@RequiereModulo('travel')
@Controller('admin/travel/vuelos')
export class TravelVuelosController {
  constructor(private readonly travelService: TravelService) {}

  @Post('buscar')
  @Permissions('travel.buscar')
  buscar(@Body() dto: BuscarVuelosDto) {
    return this.travelService.buscarVuelos(dto);
  }
}
