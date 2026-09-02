import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClienteTiendaAuthService } from './cliente-tienda-auth.service';
import { RegistroClienteTiendaDto } from './dto/registro-cliente-tienda.dto';
import { LoginClienteTiendaDto } from './dto/login-cliente-tienda.dto';
import { Public } from '../common/decorators/public.decorator';

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

  @Post('login')
  login(@Param('subdominio') subdominio: string, @Body() dto: LoginClienteTiendaDto) {
    return this.clienteTiendaAuthService.login(subdominio, dto);
  }
}
