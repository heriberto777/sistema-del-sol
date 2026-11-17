import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class ConfiguracionesRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  listar() {
    return this.db.configuracion.findMany({ orderBy: { clave: 'asc' } });
  }

  buscarPorClave(clave: string, tenantId: string) {
    return this.db.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave } } });
  }

  /**
   * Para leer una configuración desde DENTRO de una transacción ya abierta
   * por OTRO servicio (ej. `AjustesInventarioService.cambiarEstado`,
   * `ComprasService.recibir` — ver `InventarioService.resolverStockMinimoDefaultEnTx`)
   * — bug real encontrado al conectar STOCK_MINIMO_DEFAULT: con RLS activo,
   * `buscarPorClave` (que usa `this.tenantPrisma.client` suelto) cae en OTRA
   * conexión sin el `SET LOCAL app.tenant_id` de esa transacción y la policy
   * la filtra a cero filas — mismo gotcha ya documentado en
   * ARCHITECTURE.md para tablas hijas. Usar siempre el `tx` recibido, nunca
   * `this.db`, cuando ya existe una transacción abierta más arriba.
   */
  buscarPorClaveEnTx(tx: Prisma.TransactionClient, clave: string, tenantId: string) {
    return tx.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave } } });
  }

  actualizar(clave: string, valor: string, tenantId: string) {
    return this.db.configuracion.upsert({
      where: { tenantId_clave: { tenantId, clave } },
      update: { valor },
      create: { tenantId, clave, valor },
    });
  }
}
