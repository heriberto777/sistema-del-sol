import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../types/authenticated-request';
import { AuthenticatedPlatformRequest } from '../../platform-auth/platform-authenticated-request';

const METODOS_AUDITABLES = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & AuthenticatedPlatformRequest>();

    if (!METODOS_AUDITABLES.has(request.method) || !request.user) {
      return next.handle();
    }

    // request.user lo pueblan tanto el JwtStrategy de tenants (tenantId +
    // userId) como el de plataforma (adminId, sin tenantId) — cada uno va a
    // su propia tabla porque audit_logs es tenant-scoped.
    if (request.user.tenantId) {
      return next.handle().pipe(
        tap((respuesta) => {
          this.prisma.auditLog
            .create({
              data: {
                tenantId: request.user.tenantId,
                userId: request.user.userId,
                accion: `${request.method} ${request.route?.path ?? request.url}`,
                entidad: context.getClass().name.replace('Controller', ''),
                entidadId: (respuesta as { id?: string })?.id,
                despues: respuesta as object,
                ip: request.ip,
              },
            })
            .catch((error) => {
              console.error('No se pudo escribir el audit log', error);
            });
        }),
      );
    }

    if (request.user.adminId) {
      return next.handle().pipe(
        tap((respuesta) => {
          this.prisma.platformAuditLog
            .create({
              data: {
                adminId: request.user.adminId,
                accion: `${request.method} ${request.route?.path ?? request.url}`,
                entidad: context.getClass().name.replace('Controller', ''),
                entidadId: (respuesta as { id?: string })?.id,
                despues: respuesta as object,
                ip: request.ip,
              },
            })
            .catch((error) => {
              console.error('No se pudo escribir el platform audit log', error);
            });
        }),
      );
    }

    return next.handle();
  }
}
