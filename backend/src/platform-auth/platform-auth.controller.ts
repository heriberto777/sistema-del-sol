import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  @Public()
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
