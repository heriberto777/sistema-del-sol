import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../backend/src/common/decorators/permissions.decorator';
import { RequiereModulo } from '../../../backend/src/common/decorators/requiere-modulo.decorator';

/**
 * Controller de ejemplo del plugin Inmobiliaria. Sirve como plantilla para
 * los próximos plugins (Clínica, Casa de Cambio): las rutas quedan
 * protegidas tanto por permisos de rol (@Permissions) como por si la
 * plataforma le activó el módulo "inmobiliaria" a este tenant (vía Plan
 * o excepción puntual — @RequiereModulo, ModuloActivoGuard global).
 */
@ApiBearerAuth()
@ApiTags('plugin-inmobiliaria')
@RequiereModulo('inmobiliaria')
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
