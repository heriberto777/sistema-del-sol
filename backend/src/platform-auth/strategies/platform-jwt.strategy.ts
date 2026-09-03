import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PlatformAdminPayload } from '../platform-authenticated-request';
import { obtenerSecretoJwt } from '../../common/utils/jwt-secret.util';

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'jwt-platform') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: obtenerSecretoJwt('PLATFORM_JWT_SECRET'),
    });
  }

  async validate(payload: PlatformAdminPayload): Promise<PlatformAdminPayload> {
    return payload;
  }
}
