import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EcommerceService } from './ecommerce.service';
import { CatalogoTiendaQueryDto } from './dto/catalogo-tienda-query.dto';
import { CrearPedidoTiendaDto } from './dto/crear-pedido-tienda.dto';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ClienteTiendaAuthGuard } from '../cliente-tienda-auth/guards/cliente-tienda-auth.guard';
import { CurrentClienteTienda } from '../cliente-tienda-auth/current-cliente-tienda.decorator';
import { ClienteTiendaPayload } from '../cliente-tienda-auth/cliente-tienda-authenticated-request';

/**
 * Storefront público de la Tienda Online (plugin e-commerce v1) — sin
 * JWT, resuelto por `:subdominio` explícito en la URL (mismo criterio que
 * `AuthService.login`, sin infraestructura de hostname/DNS nueva). Ver
 * EcommerceService.resolverTiendaPublica para el gating (tenant activo +
 * módulo "ecommerce" + tienda activada).
 */
@ApiTags('tienda-publica')
@Public()
@Controller('tienda/:subdominio')
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get('config')
  config(@Param('subdominio') subdominio: string) {
    return this.ecommerceService.obtenerConfig(subdominio);
  }

  @Get('productos')
  catalogo(@Param('subdominio') subdominio: string, @Query() query: CatalogoTiendaQueryDto) {
    return this.ecommerceService.catalogo(subdominio, query);
  }

  @Get('productos/:productoId')
  producto(@Param('subdominio') subdominio: string, @Param('productoId') productoId: string, @Req() request: AuthenticatedRequest) {
    return this.ecommerceService.producto(subdominio, productoId, request);
  }

  @Post('pedidos')
  crearPedido(@Param('subdominio') subdominio: string, @Body() dto: CrearPedidoTiendaDto, @Req() request: AuthenticatedRequest) {
    return this.ecommerceService.crearPedido(subdominio, dto, request);
  }

  /**
   * @UseGuards acá (no en la clase) — el resto del controller sigue
   * siendo público sin sesión; esta es la única ruta que además exige
   * la estrategia 'jwt-cliente-tienda' (ClienteTiendaAuthGuard), sobre
   * el @Public() de la clase que ya la exime del JwtAuthGuard de
   * tenants.
   */
  @Get('mis-pedidos')
  @UseGuards(ClienteTiendaAuthGuard)
  misPedidos(@Param('subdominio') subdominio: string, @CurrentClienteTienda() cliente: ClienteTiendaPayload) {
    return this.ecommerceService.misPedidos(subdominio, cliente);
  }
}
