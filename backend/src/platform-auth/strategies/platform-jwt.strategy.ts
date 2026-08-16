import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PlatformAdminPayload } from '../platform-authenticated-request';

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'jwt-platform') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.PLATFORM_JWT_SECRET ?? 'cambia-este-secreto-de-plataforma-en-produccion',
    });
  }

  async validate(payload: PlatformAdminPayload): Promise<PlatformAdminPayload> {
    return payload;
  }
}
