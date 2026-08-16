import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protege las rutas de plataforma (/platform/**) con la estrategia
 * 'jwt-platform' (secreto y payload propios, completamente separados de
 * JwtAuthGuard de tenants). Las rutas que usan este guard deben además
 * llevar @Public() para que el JwtAuthGuard global de tenants no intente
 * validar el token con SU secreto y lo rechace antes de llegar aquí.
 */
@Injectable()
export class PlatformAuthGuard extends AuthGuard('jwt-platform') {}
