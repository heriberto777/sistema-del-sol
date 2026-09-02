import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClienteTiendaPayload } from '../cliente-tienda-authenticated-request';
import { CLIENTE_TIENDA_JWT_SECRET } from '../cliente-tienda-jwt.constants';

@Injectable()
export class ClienteTiendaJwtStrategy extends PassportStrategy(Strategy, 'jwt-cliente-tienda') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: CLIENTE_TIENDA_JWT_SECRET,
    });
  }

  async validate(payload: ClienteTiendaPayload): Promise<ClienteTiendaPayload> {
    return payload;
  }
}
