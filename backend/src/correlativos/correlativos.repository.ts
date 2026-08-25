import { Injectable } from '@nestjs/common';
import { Prisma, TipoCorrelativo } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const CORRELATIVO_DEFAULT = { prefijo: '', digitos: 5, siguienteNumero: 1 } as const;

@Injectable()
export class CorrelativosRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /**
   * Toma el próximo número de forma atómica para el tipo dado — mismo
   * patrón que FacturacionRepository.siguienteNcfEnTx (`{ increment: 1 }`,
   * ver ese comentario para el razonamiento de por qué es seguro bajo
   * concurrencia: el UPDATE es relativo al valor de la fila en ese
   * momento, no al leído por el findFirst de arriba). `siguienteNumero`
   * apunta al PRÓXIMO a asignar, así que el número devuelto es el valor
   * ANTES de incrementar.
   *
   * Si el tenant todavía no tiene fila para este tipo (backfill no
   * corrido / tenant creado antes de esta feature), la crea con los
   * defaults antes de consumirla — defensa en profundidad; en producción
   * ya debería existir (sembrada en TenantsRepository.crearConProvisioning).
   * `tenantId` explícito solo hace falta para ESTE create de respaldo — el
   * resto de las operaciones ya están tenant-scoped automáticamente por
   * TenantPrismaService.
   */
  async siguienteEnTx(tx: Prisma.TransactionClient, tenantId: string, tipo: TipoCorrelativo): Promise<string> {
    const correlativo =
      (await tx.correlativo.findFirst({ where: { tipo } })) ??
      (await tx.correlativo.create({ data: { tenantId, tipo, ...CORRELATIVO_DEFAULT } }));
    const actualizada = await tx.correlativo.update({
      where: { id: correlativo.id },
      data: { siguienteNumero: { increment: 1 } },
    });
    return `${actualizada.prefijo}${String(actualizada.siguienteNumero - 1).padStart(actualizada.digitos, '0')}`;
  }

  /** Variante fuera de una transacción externa — usada por el botón "Asignar" de Producto/CuentaContable. */
  siguiente(tenantId: string, tipo: TipoCorrelativo): Promise<string> {
    return this.db.$transaction((tx) => this.siguienteEnTx(tx, tenantId, tipo));
  }

  /** Siempre devuelve las 6 filas (una por TipoCorrelativo), rellenando con defaults las que el tenant no tenga todavía. */
  async listar() {
    const filas = await this.db.correlativo.findMany();
    const porTipo = new Map(filas.map((f) => [f.tipo, f]));
    return Object.values(TipoCorrelativo).map((tipo) => porTipo.get(tipo) ?? { id: null, tipo, ...CORRELATIVO_DEFAULT });
  }

  async actualizar(tenantId: string, tipo: TipoCorrelativo, data: Partial<{ prefijo: string; siguienteNumero: number; digitos: number }>) {
    const correlativo =
      (await this.db.correlativo.findFirst({ where: { tipo } })) ??
      (await this.db.correlativo.create({ data: { tenantId, tipo, ...CORRELATIVO_DEFAULT } }));
    return this.db.correlativo.update({ where: { id: correlativo.id }, data });
  }
}
