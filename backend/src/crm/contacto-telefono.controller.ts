import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContactoTelefonoService } from './contacto-telefono.service';
import { BuscarContactoPorTelefonoQueryDto } from './dto/buscar-contacto-por-telefono-query.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';

@ApiBearerAuth()
@ApiTags('crm')
@RequiereModulo('crm')
@Controller('crm/contactos')
export class ContactoTelefonoController {
  constructor(private readonly contactoTelefonoService: ContactoTelefonoService) {}

  @Get('por-telefono')
  @Permissions('crm.ver')
  porTelefono(@Query() query: BuscarContactoPorTelefonoQueryDto) {
    return this.contactoTelefonoService.porTelefono(query.telefono);
  }
}
