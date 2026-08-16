import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { AppPrismaService } from './app-prisma.service';
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

// Marca "la transacción actual ya tiene SET LOCAL app.tenant_id aplicado" —
// ver el `Proxy` de $transaction y $allOperations más abajo. Un solo
// AsyncLocalStorage compartido por todo el proceso es el patrón normal: cada
// request corre en su propio contexto async, así que .run()/.getStore() los
// aísla igual aunque el objeto ALS sea el mismo para todos.
const alsSetLocal = new AsyncLocalStorage<boolean>();

/**
 * Cliente de Prisma con aislamiento de tenant en dos capas:
 *
 * 1. Aplicación: inyecta tenantId en el `where` de toda lectura/escritura y
 *    en el `data` de toda creación, para los modelos de TENANT_SCOPED_MODELS
 *    (sin cambios respecto a la versión anterior de este archivo).
 * 2. Base de datos: además, antes de cada operación tenant-scoped, aplica
 *    `SELECT set_config('app.tenant_id', ...)` dentro de una transacción —
 *    lo que hace que las policies de Row-Level Security de
 *    prisma/sql/enable-rls.sql protejan de verdad (antes existían pero no
 *    hacían nada: ver docs/ARCHITECTURE.md). Esto requiere que `this.client`
 *    esté conectado con el rol restringido (AppPrismaService/APP_DATABASE_URL,
 *    ver scripts/setup-app-role.ts), no con el rol de migraciones
 *    (superusuario, ignora RLS).
 *
 * `SET LOCAL` solo dura mientras dure la transacción que lo aplicó, así que
 * TODA operación tenant-scoped pasa a correr dentro de una transacción:
 * - Si ya está dentro de una abierta por `$transaction` (ver el `Proxy` más
 *   abajo) — la mayoría de los flujos multi-paso (`FacturacionService.crear`,
 *   `ComprasService.recibir`, etc.) — el SET LOCAL ya se aplicó una vez al
 *   abrir esa transacción; la query sigue de largo sin envolver nada más.
 * - Si es una llamada suelta (la mayoría de los repositorios,
 *   ej. `cliente.findMany(...)`) — se abre una transacción de una sola
 *   operación solo para que el SET LOCAL tenga efecto. Es un costo real de
 *   latencia (un BEGIN/COMMIT de más por query), aceptado a propósito: es el
 *   precio de que el SET LOCAL no se filtre entre tenants distintos que
 *   reusan la misma conexión de un pool compartido.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  public readonly client: PrismaService;

  constructor(
    @Inject(REQUEST) request: AuthenticatedRequest,
    appPrisma: AppPrismaService,
  ) {
    function tenantIdActual(): string {
      // OJO: no capturar `request.user?.tenantId` en una const del constructor.
      // Este provider es request-scoped, pero Nest puede instanciarlo antes de
      // que JwtAuthGuard termine de poblar `request.user` — por eso se lee acá
      // adentro, en el momento real de cada query/transacción, no antes.
      const tenantId = request.user?.tenantId;
      if (!tenantId) {
        throw new ForbiddenException('No hay tenant en el contexto de la petición');
      }
      return tenantId;
    }

    async function fijarTenantEnSesion(tx: { $executeRaw: PrismaService['$executeRaw'] }, tenantId: string) {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    }

    // `params.model` en $allOperations viene en PascalCase (el nombre del
    // modelo en schema.prisma, ej. "Producto") — el accessor real del
    // cliente Prisma es camelCase ("producto"). Sin esto, `tx[model]` busca
    // una propiedad que no existe.
    function nombrePropiedadCliente(model: string): string {
      return model.charAt(0).toLowerCase() + model.slice(1);
    }

    const extendido = appPrisma.$extends({
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

            if (!model) {
              // $queryRaw/$executeRaw sueltos (fuera de un $transaction ya
              // abierto) no pasan por acá con un `model` — hoy ningún call
              // site los usa así (siempre van dentro de un `tx` ya abierto,
              // ver InventarioRepository.descontarStockCondicionalEnTx), así
              // que quedan sin SET LOCAL a propósito. Si se agrega uno nuevo
              // fuera de una transacción, hay que sumarle soporte acá.
              return query(args);
            }

            // Inyección de tenantId en el `where`/`data`: solo tiene sentido
            // para modelos que tienen la columna (TENANT_SCOPED_MODELS).
            if (TENANT_SCOPED_MODELS.has(model)) {
              const tenantId = tenantIdActual();
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
            }

            if (alsSetLocal.getStore()) {
              // Ya estamos dentro de una transacción con SET LOCAL aplicado
              // (ver el Proxy de $transaction) — sigue de largo tal cual.
              return query(args);
            }

            // SET LOCAL / envolver en transacción: a diferencia de la
            // inyección de arriba, esto NO se puede limitar a
            // TENANT_SCOPED_MODELS. Un modelo "hijo" sin tenantId propio
            // (LineaAsiento, LineaFactura, Stock, Precio, etc. — ver
            // docs/DATABASE.md) puede filtrar/incluir una relación hacia un
            // modelo PADRE que sí tiene RLS forzado (ej. `lineaAsiento.
            // findMany({ where: { asiento: { fecha: {...} } } })` hace un
            // JOIN contra `asientos_contables`) — si esta conexión nunca
            // seteó `app.tenant_id`, ese JOIN filtra la policy de RLS y
            // devuelve cero filas aunque los datos sí pertenezcan al tenant
            // (bug real: encontrado en CierrePeriodoService.cerrarPeriodo,
            // que vía `lineasEnRango` no traía ninguna línea a pesar de que
            // los asientos sí existían).
            const tenantId = tenantIdActual();

            // Llamada suelta fuera de cualquier $transaction explícito: se
            // envuelve en una transacción de una sola operación para que el
            // SET LOCAL tenga efecto. `appPrisma` (no `extendido`/`this.client`)
            // a propósito: llamar al método directo sobre `tx` no vuelve a
            // pasar por este mismo $allOperations (evita recursión infinita).
            const propiedad = nombrePropiedadCliente(model);
            return appPrisma.$transaction(async (tx) => {
              await fijarTenantEnSesion(tx, tenantId);
              return alsSetLocal.run(true, () => (tx as any)[propiedad][operation](args));
            });
          },
        },
      },
    });

    // Prisma no permite overridear $transaction vía extensión (solo agregar
    // métodos $-nuevos), así que un Proxy es la única forma de interceptarlo
    // sin tocar cada call site que ya hace `tenantPrisma.client.$transaction(...)`.
    this.client = new Proxy(extendido, {
      get(target, prop, receiver) {
        if (prop !== '$transaction') {
          return Reflect.get(target, prop, receiver);
        }

        return (arg: unknown, options?: unknown) => {
          if (typeof arg !== 'function') {
            // La forma array ($transaction([...])) no la usa ningún
            // repositorio tenant-scoped hoy (confirmado por grep) — si
            // alguna vez se necesita, hay que sumarle soporte acá en vez de
            // dejar pasar un SET LOCAL silenciosamente ausente.
            throw new Error(
              'TenantPrismaService.$transaction solo soporta la forma callback ($transaction(async tx => ...)), no la forma array.',
            );
          }

          if (alsSetLocal.getStore()) {
            // Prisma no soporta transacciones anidadas de verdad. Si esto
            // dispara, es un bug: el código que ya participa de una
            // transacción abierta debería usar la variante *EnTx que recibe
            // el `tx` existente (ver FacturacionService.crear/anular), no
            // volver a llamar $transaction.
            throw new Error(
              'Se llamó $transaction dentro de otra transacción ya abierta. Usá la variante *EnTx correspondiente para participar de la transacción existente en vez de abrir otra.',
            );
          }

          const tenantId = tenantIdActual();
          return (target as any).$transaction(async (tx: unknown) => {
            await fijarTenantEnSesion(tx as { $executeRaw: PrismaService['$executeRaw'] }, tenantId);
            return alsSetLocal.run(true, () => (arg as (tx: unknown) => unknown)(tx));
          }, options);
        };
      },
    }) as unknown as PrismaService;
  }
}
