import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protege rutas del storefront que exigen sesión de comprador (ej.
 * "Mis pedidos") con la estrategia 'jwt-cliente-tienda' (secreto y
 * payload propios, separados de JwtAuthGuard de tenants y
 * PlatformAuthGuard de plataforma). Las rutas que usan este guard deben
 * además llevar @Public() para que el JwtAuthGuard global de tenants no
 * intente validar el token con SU secreto y lo rechace antes de llegar
 * acá — mismo patrón que PlatformAuthGuard.
 */
@Injectable()
export class ClienteTiendaAuthGuard extends AuthGuard('jwt-cliente-tienda') {}
