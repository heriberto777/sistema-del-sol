import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../backend/src/common/decorators/permissions.decorator';
import { RequiresPlugin } from '../../../backend/src/common/decorators/requires-plugin.decorator';

/**
 * Controller de ejemplo del plugin Inmobiliaria. Sirve como plantilla para
 * los próximos plugins (Clínica, Casa de Cambio): las rutas quedan
 * protegidas tanto por permisos de rol (@Permissions) como por la
 * activación del plugin para el tenant actual (@RequiresPlugin), vía
 * PluginActiveGuard.
 */
@ApiBearerAuth()
@ApiTags('plugin-inmobiliaria')
@RequiresPlugin('inmobiliaria')
@Controller('plugins/inmobiliaria/propiedades')
export class InmobiliariaController {
  @Get()
  @Permissions('inmobiliaria.propiedades.ver')
  listar() {
    // TODO: reemplazar por InmobiliariaService + modelos Prisma propios
    // (Propiedad, ContratoAlquiler, ContratoVenta, Cobro) agregados a
    // backend/prisma/schema.prisma al instalar este plugin.
    return [];
  }
}
