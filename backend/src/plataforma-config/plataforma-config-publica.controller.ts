import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlataformaConfigService } from './plataforma-config.service';
import { Public } from '../common/decorators/public.decorator';

/**
 * Sin sesión, a propósito separado de PlataformaConfigController (que
 * lleva PlatformAuthGuard/PlatformPermissionsGuard a nivel de clase) —
 * el Login necesita el logo de plataforma antes de resolver tenant, y
 * este controller nunca debe crecer más allá de ese único campo.
 */
@ApiTags('platform-branding')
@Public()
@Controller('platform/branding')
export class PlataformaConfigPublicaController {
  constructor(private readonly plataformaConfigService: PlataformaConfigService) {}

  @Get()
  obtener() {
    return this.plataformaConfigService.obtenerPublica();
  }
}
