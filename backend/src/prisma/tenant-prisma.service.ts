import { ForbiddenException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { TENANT_SCOPED_MODELS } from './tenant-scoped-models';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

const READ_OR_WRITE_BY_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

/**
 * Cliente de Prisma con aislamiento de tenant a nivel de aplicación:
 * inyecta tenantId en el `where` de toda lectura/escritura y en el `data`
 * de toda creación, para los modelos listados en TENANT_SCOPED_MODELS.
 * Row-Level Security en Postgres (prisma/sql/enable-rls.sql) actúa como
 * segunda capa de defensa por si algún query se construye a mano.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  public readonly client: PrismaService;

  constructor(
    @Inject(REQUEST) request: AuthenticatedRequest,
    prisma: PrismaService,
  ) {
    // OJO: no capturar `request.user?.tenantId` aquí en una const. Este
    // provider es request-scoped, pero Nest puede instanciarlo antes de que
    // JwtAuthGuard termine de poblar `request.user` (la instanciación eager
    // de providers en el árbol de un controller request-scoped no está
    // garantizada a ocurrir después de los guards). Por eso se lee
    // `request.user` de forma perezosa dentro del callback, en el momento
    // real de cada query — para entonces el guard ya corrió siempre.
    this.client = prisma.$extends({
      name: 'tenant-isolation',
      query: {
        $allModels: {
          // Prisma tipa $allOperations sobre la unión de los args de TODAS las
          // operaciones de TODOS los modelos; no hay forma de estrechar ese
          // tipo según `operation` en tiempo de compilación, así que se maneja
          // como `any` aquí adentro. Los call sites de cada repositorio siguen
          // type-checkeados normalmente porque usan los métodos tipados del
          // cliente (`this.client.factura.create(...)`), no este callback.
          async $allOperations(params: any) {
            const { model, operation, args, query } = params;

            if (!model || !TENANT_SCOPED_MODELS.has(model)) {
              return query(args);
            }

            const tenantId = request.user?.tenantId;
            if (!tenantId) {
              throw new ForbiddenException('No hay tenant en el contexto de la petición');
            }

            if (operation === 'create') {
              args.data = { ...args.data, tenantId };
            } else if (operation === 'createMany' && Array.isArray(args.data)) {
              args.data = args.data.map((registro: Record<string, unknown>) => ({
                ...registro,
                tenantId,
              }));
            } else if (READ_OR_WRITE_BY_WHERE.has(operation)) {
              args.where = { ...(args.where ?? {}), tenantId };
            }

            return query(args);
          },
        },
      },
    }) as unknown as PrismaService;
  }
}
