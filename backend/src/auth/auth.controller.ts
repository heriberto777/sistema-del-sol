import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResolverEmpresasDto } from './dto/resolver-empresas.dto';
import { OlvidePasswordDto } from './dto/olvide-password.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Throttled con el mismo criterio que password/olvide: revela intencionalmente
  // el nombre de la empresa para un email dado (así lo pidió el usuario, es el
  // primer paso del login), pero limitado para no habilitar enumeración masiva.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post('resolver-empresas')
  resolverEmpresas(@Body() dto: ResolverEmpresasDto) {
    return this.authService.resolverEmpresas(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('password/olvide')
  olvidePassword(@Body() dto: OlvidePasswordDto) {
    return this.authService.olvidePassword(dto);
  }

  @Public()
  @Post('password/restablecer')
  restablecerPassword(@Body() dto: RestablecerPasswordDto) {
    return this.authService.restablecerPassword(dto);
  }
}
