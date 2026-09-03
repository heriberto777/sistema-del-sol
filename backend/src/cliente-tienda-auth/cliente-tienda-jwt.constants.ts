import { obtenerSecretoJwt } from '../common/utils/jwt-secret.util';

/** Secreto propio del tercer dominio de auth (tenant/plataforma/cliente-tienda) — nunca el mismo que JWT_SECRET/PLATFORM_JWT_SECRET, ver ClienteTiendaJwtStrategy. Constante compartida (en vez de leer process.env en cada lugar) porque EcommerceService.resolverClienteId también la necesita, sin acoplar ambos módulos entre sí. */
export const CLIENTE_TIENDA_JWT_SECRET = obtenerSecretoJwt('CLIENTE_TIENDA_JWT_SECRET');
export const CLIENTE_TIENDA_JWT_EXPIRATION = process.env.CLIENTE_TIENDA_JWT_EXPIRATION ?? '30d';
