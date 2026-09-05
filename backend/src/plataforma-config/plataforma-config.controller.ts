import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlataformaConfigService } from './plataforma-config.service';
import { ActualizarPlataformaConfigDto } from './dto/actualizar-plataforma-config.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformAuthGuard } from '../platform-auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';
import { AnalizadorImagenService } from '../ia/analizador-imagen/analizador-imagen.service';

@ApiBearerAuth()
@ApiTags('platform-configuracion')
@Public() // el JwtAuthGuard global de tenants no debe intervenir aquí
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/configuracion')
export class PlataformaConfigController {
  constructor(
    private readonly plataformaConfigService: PlataformaConfigService,
    private readonly analizadorImagenService: AnalizadorImagenService,
  ) {}

  @Get()
  @PlatformPermissions('platform.configuracion.ver')
  obtener() {
    return this.plataformaConfigService.obtener();
  }

  @Patch()
  @PlatformPermissions('platform.configuracion.gestionar')
  actualizar(@Body() dto: ActualizarPlataformaConfigDto) {
    return this.plataformaConfigService.actualizar(dto);
  }

  /** Modelos reales disponibles para la API key ya guardada de ese proveedor — evita que el admin tenga que tipear el nombre del modelo a mano. */
  @Get('ia-imagen/modelos')
  @PlatformPermissions('platform.configuracion.ver')
  async listarModelosIa(@Query('proveedor') proveedor: string) {
    const modelos = await this.analizadorImagenService.listarModelos(proveedor);
    return { modelos };
  }
}
