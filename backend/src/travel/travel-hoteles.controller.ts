import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { BuscarHotelesDto } from './dto/buscar-hoteles.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

/** Búsqueda pura contra el proveedor de hoteles activo — mismo criterio que TravelVuelosController. */
@ApiBearerAuth()
@ApiTags('travel')
@RequiereModulo('travel')
@Controller('admin/travel/hoteles')
export class TravelHotelesController {
  constructor(private readonly travelService: TravelService) {}

  @Post('buscar')
  @Permissions('travel.buscar')
  buscar(@Body() dto: BuscarHotelesDto) {
    return this.travelService.buscarHoteles(dto);
  }
}
