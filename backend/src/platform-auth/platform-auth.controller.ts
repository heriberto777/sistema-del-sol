import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { limiteLogin } from '../common/utils/limite-login.util';
import { ApiTags } from '@nestjs/swagger';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { OlvidePasswordPlataformaDto } from './dto/olvide-password-plataforma.dto';
import { RestablecerPasswordPlataformaDto } from './dto/restablecer-password-plataforma.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('platform-auth')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  // Freno de fuerza bruta (auditoría de seguridad) — más estricto que el
  // login de tenant: comprometer una cuenta de plataforma da control de
  // TODOS los tenants, hay pocas cuentas reales así que el falso
  // positivo de un admin legítimo reintentando es poco costoso.
  @Public()
  @Throttle({ default: { limit: limiteLogin(5), ttl: 15 * 60 * 1000 } })
  @Post('login')
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAuthService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('password/olvide')
  olvidePassword(@Body() dto: OlvidePasswordPlataformaDto) {
    return this.platformAuthService.olvidePassword(dto);
  }

  @Public()
  @Post('password/restablecer')
  restablecerPassword(@Body() dto: RestablecerPasswordPlataformaDto) {
    return this.platformAuthService.restablecerPassword(dto);
  }
}
