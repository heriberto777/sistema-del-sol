import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { ClienteTiendaPayload } from '../cliente-tienda-authenticated-request';
import { CLIENTE_TIENDA_JWT_SECRET } from '../cliente-tienda-jwt.constants';
import { claveTokenRevocado } from '../token-revocado.util';

@Injectable()
export class ClienteTiendaJwtStrategy extends PassportStrategy(Strategy, 'jwt-cliente-tienda') {
  constructor(private readonly redis: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: CLIENTE_TIENDA_JWT_SECRET,
      passReqToCallback: true,
    });
  }

  // `passReqToCallback: true` para poder recuperar el token crudo (la
  // firma ya se validó antes de llegar acá) y chequearlo contra la
  // blacklist de "cerrar sesión" — ver token-revocado.util.ts.
  async validate(req: Request, payload: ClienteTiendaPayload): Promise<ClienteTiendaPayload> {
    const tokenCrudo = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (tokenCrudo && (await this.redis.client.get(claveTokenRevocado(tokenCrudo)))) {
      throw new UnauthorizedException('Sesión cerrada — iniciá sesión de nuevo');
    }
    return payload;
  }
}
