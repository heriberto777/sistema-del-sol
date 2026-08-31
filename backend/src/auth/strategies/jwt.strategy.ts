import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayloadUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'cambia-este-secreto-en-produccion',
    });
  }

  /**
   * Fase 4 (auto-suspensión) — antes esto devolvía el payload tal cual: un
   * tenant suspendido (manual o automático) seguía con acceso completo con
   * cualquier JWT ya emitido hasta que expirara (hasta JWT_EXPIRATION,
   * default 24h) — no había ningún punto de revalidación entre requests.
   * Una sola lectura indexada por PK, mismo orden de costo que el `SET
   * LOCAL app.tenant_id` que TenantPrismaService ya hace por request (ver
   * docs/ARCHITECTURE.md, "Multi-tenancy").
   */
  async validate(payload: JwtPayloadUser): Promise<JwtPayloadUser> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: payload.tenantId }, select: { estado: true } });
    if (!tenant || tenant.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Tenant no encontrado o inactivo');
    }
    return payload;
  }
}
