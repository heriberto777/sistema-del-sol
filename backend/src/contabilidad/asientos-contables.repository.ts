import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrigenAsiento, Prisma } from '@prisma/client';

interface LineaAsientoInput {
  cuentaContableId: string;
  debito: number;
  credito: number;
  descripcion?: string;
}

const INCLUDE_ASIENTO = { lineas: { include: { cuentaContable: true } } } as const;
const MAX_INTENTOS_NUMERO = 5;

@Injectable()
export class AsientosContablesRepository {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * `MAX(numero)+1` calculado dentro de la transacción no evita la carrera
   * por sí solo: dos transacciones concurrentes pueden leer el mismo MAX
   * (bajo READ COMMITTED, el nivel por defecto) e intentar crear el mismo
   * `numero` — el `@@unique([tenantId, numero])` evita el duplicado, pero
   * antes de este fix esa colisión (P2002) se propagaba sin reintentar,
   * así que uno de los dos asientos simplemente NO se creaba (pérdida
   * silenciosa de un asiento contable real, con el error solo logueado —
   * ver ContabilidadEventosService). Reintentar con un MAX recalculado es
   * seguro precisamente porque, a diferencia del NCF, este número es solo
   * una referencia interna sin requisito legal de continuidad estricta —
   * un hueco ocasional por un reintento no es un problema.
   */
  private async conReintentoDeNumero<T>(intentarUnaVez: () => Promise<T>): Promise<T> {
    for (let intento = 1; intento <= MAX_INTENTOS_NUMERO; intento++) {
      try {
        return await intentarUnaVez();
      } catch (error) {
        const esConflictoDeNumero = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!esConflictoDeNumero || intento === MAX_INTENTOS_NUMERO) throw error;
      }
    }
    throw new Error('No debería alcanzarse: conReintentoDeNumero agotó los intentos sin retornar ni lanzar.');
  }

  crear(params: {
    tenantId: string;
    concepto: string;
    origen: OrigenAsiento;
    origenId?: string;
    fecha?: Date;
    lineas: LineaAsientoInput[];
  }) {
    return this.conReintentoDeNumero(() =>
      this.db.$transaction(async (tx) => {
        const ultimo = await tx.asientoContable.aggregate({
          where: { tenantId: params.tenantId },
          _max: { numero: true },
        });
        const numero = (ultimo._max.numero ?? 0) + 1;

        return tx.asientoContable.create({
          data: {
            tenantId: params.tenantId,
            numero,
            concepto: params.concepto,
            origen: params.origen,
            origenId: params.origenId,
            fecha: params.fecha ?? new Date(),
            lineas: { create: params.lineas },
          },
          include: INCLUDE_ASIENTO,
        });
      }),
    );
  }

  /** Usado por ContabilidadEventosService, fuera del contexto de un request HTTP (ver WebhooksRepository para el mismo patrón). */
  crearGlobal(params: {
    tenantId: string;
    concepto: string;
    origen: OrigenAsiento;
    origenId?: string;
    fecha?: Date;
    lineas: LineaAsientoInput[];
  }) {
    return this.conReintentoDeNumero(() =>
      this.prisma.$transaction(async (tx) => {
        const ultimo = await tx.asientoContable.aggregate({
          where: { tenantId: params.tenantId },
          _max: { numero: true },
        });
        const numero = (ultimo._max.numero ?? 0) + 1;

        return tx.asientoContable.create({
          data: {
            tenantId: params.tenantId,
            numero,
            concepto: params.concepto,
            origen: params.origen,
            origenId: params.origenId,
            fecha: params.fecha ?? new Date(),
            lineas: { create: params.lineas },
          },
          include: INCLUDE_ASIENTO,
        });
      }),
    );
  }

  buscarPorId(id: string) {
    return this.db.asientoContable.findUniqueOrThrow({ where: { id }, include: INCLUDE_ASIENTO });
  }

  listar(params: { skip: number; take: number; busqueda?: string }) {
    const where = params.busqueda ? { concepto: { contains: params.busqueda, mode: 'insensitive' as const } } : {};
    return Promise.all([
      this.db.asientoContable.findMany({
        where,
        orderBy: { numero: 'desc' },
        include: INCLUDE_ASIENTO,
        skip: params.skip,
        take: params.take,
      }),
      this.db.asientoContable.count({ where }),
    ]);
  }

  /** Todas las líneas de todos los asientos hasta una fecha, agrupadas por cuenta — para el balance general. */
  lineasHasta(hasta: Date) {
    return this.db.lineaAsiento.findMany({
      where: { asiento: { fecha: { lte: hasta } } },
      include: { cuentaContable: true },
    });
  }

  /** Líneas de cuentas de INGRESO/GASTO dentro de un rango — para el estado de resultados y el cierre de período. */
  lineasEnRango(desde: Date, hasta: Date) {
    return this.db.lineaAsiento.findMany({
      where: {
        asiento: { fecha: { gte: desde, lte: hasta } },
        cuentaContable: { tipo: { in: ['INGRESO', 'GASTO'] } },
      },
      include: { cuentaContable: true },
    });
  }

  /** Todas las líneas de una cuenta hasta una fecha, con el asiento incluido — para el libro mayor. */
  lineasPorCuenta(cuentaContableId: string, hasta: Date) {
    return this.db.lineaAsiento.findMany({
      where: { cuentaContableId, asiento: { fecha: { lte: hasta } } },
      include: { asiento: true },
      orderBy: [{ asiento: { fecha: 'asc' } }, { asiento: { numero: 'asc' } }],
    });
  }
}
