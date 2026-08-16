import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

/**
 * Resuelve el tenantId lo antes posible en el ciclo de vida del request,
 * para logging/rate-limiting por tenant. NO es la capa de seguridad
 * (eso lo hacen JwtAuthGuard + TenantPrismaService) — aquí el token solo
 * se decodifica, no se verifica, porque el middleware corre antes que
 * los guards.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const payload = this.jwtService.decode(token) as { tenantId?: string } | null;
        if (payload?.tenantId) {
          (req as Request & { tenantId?: string }).tenantId = payload.tenantId;
        }
      } catch {
        // token inválido: lo rechazará JwtAuthGuard más adelante
      }
    }
    next();
  }
}
