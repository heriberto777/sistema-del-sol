import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { limiteLogin } from '../common/utils/limite-login.util';
import { ApiTags } from '@nestjs/swagger';
import { ClienteTiendaAuthService } from './cliente-tienda-auth.service';
import { RegistroClienteTiendaDto } from './dto/registro-cliente-tienda.dto';
import { LoginClienteTiendaDto } from './dto/login-cliente-tienda.dto';
import { CambiarPasswordClienteTiendaDto } from './dto/cambiar-password-cliente-tienda.dto';
import { Public } from '../common/decorators/public.decorator';
import { ClienteTiendaAuthGuard } from './guards/cliente-tienda-auth.guard';
import { CurrentClienteTienda } from './current-cliente-tienda.decorator';
import { ClienteTiendaPayload } from './cliente-tienda-authenticated-request';

/** Registro/login de compradores del storefront — mismo criterio de resolución de tenant (:subdominio explícito, sin JWT) que EcommerceController. */
@ApiTags('tienda-auth')
@Public()
@Controller('tienda/:subdominio/auth')
export class ClienteTiendaAuthController {
  constructor(private readonly clienteTiendaAuthService: ClienteTiendaAuthService) {}

  @Post('registro')
  registro(@Param('subdominio') subdominio: string, @Body() dto: RegistroClienteTiendaDto) {
    return this.clienteTiendaAuthService.registro(subdominio, dto);
  }

  // Freno de fuerza bruta (auditoría de seguridad) — mismo criterio que auth/login.
  @Throttle({ default: { limit: limiteLogin(10), ttl: 15 * 60 * 1000 } })
  @Post('login')
  login(@Param('subdominio') subdominio: string, @Body() dto: LoginClienteTiendaDto) {
    return this.clienteTiendaAuthService.login(subdominio, dto);
  }

  @Patch('password')
  @UseGuards(ClienteTiendaAuthGuard)
  cambiarPassword(
    @Param('subdominio') subdominio: string,
    @CurrentClienteTienda() cliente: ClienteTiendaPayload,
    @Body() dto: CambiarPasswordClienteTiendaDto,
  ) {
    return this.clienteTiendaAuthService.cambiarPassword(subdominio, cliente, dto);
  }
}
