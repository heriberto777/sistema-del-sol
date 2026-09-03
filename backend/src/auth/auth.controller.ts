import { Body, Controller, Delete, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { limiteLogin } from '../common/utils/limite-login.util';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResolverEmpresasDto } from './dto/resolver-empresas.dto';
import { OlvidePasswordDto } from './dto/olvide-password.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { EstablecerPinDto } from './dto/establecer-pin.dto';
import { EliminarPinDto } from './dto/eliminar-pin.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/types/authenticated-request';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Freno de fuerza bruta (auditoría de seguridad) — antes solo lo cubría
  // el límite global de la app (120 req/min por IP), generoso para
  // probar contraseñas. Mismo criterio de límite que resolver-empresas.
  @Public()
  @Throttle({ default: { limit: limiteLogin(10), ttl: 15 * 60 * 1000 } })
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

  // Autoservicio (Fase 9) — sin @Permissions, cualquier usuario autenticado
  // administra su propio PIN, igual criterio que cambiar su contraseña.
  @ApiBearerAuth()
  @Put('mi-pin')
  establecerPin(@Body() dto: EstablecerPinDto, @CurrentUser() user: JwtPayloadUser) {
    return this.authService.establecerPin(user.userId, dto);
  }

  @ApiBearerAuth()
  @Delete('mi-pin')
  eliminarPin(@Body() dto: EliminarPinDto, @CurrentUser() user: JwtPayloadUser) {
    return this.authService.eliminarPin(user.userId, dto);
  }
}
