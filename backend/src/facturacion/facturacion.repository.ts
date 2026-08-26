import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ModalidadFacturacion, Prisma, TipoFactura, TipoNcf } from '@prisma/client';

interface LineaCalculada {
  // Nullable (ítem B-9) — exactamente uno de productoId/descripcionManual,
  // ver FacturacionService.calcularLineasYTotales.
  productoId: string | null;
  varianteId: string | null;
  descripcionManual?: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  porcentajeItbis: number;
  montoItbis: number;
  montoTotal: number;
  // Ítem A-1 — ver FacturacionService.calcularLineasYTotales.
  pagaComision: boolean;
}

@Injectable()
export class FacturacionRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private get db() {
    return this.tenantPrisma.client;
  }

  /** `Tenant` no es un modelo tenant-scoped (es la tabla raíz) — TenantPrismaService lo deja pasar sin inyectar tenantId, así que se filtra por `id` directo. */
  async obtenerModalidadFacturacion(tenantId: string): Promise<ModalidadFacturacion> {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { modalidadFacturacion: true },
    });
    return tenant.modalidadFacturacion;
  }

  /**
   * Precio cuelga de VarianteProducto (Fase 3c) — `varianteId` ya viene
   * resuelto por `FacturacionService.crear()` (ver `VariantesService.
   * resolverObligatoria`, incremento 3). Se reaplana el resultado a
   * `producto.precios` para no tocar el resto de `FacturacionService`.
   */
  async obtenerProductoConPrecioVigente(productoId: string, varianteId: string, listaPrecio = 'GENERAL') {
    const producto = await this.db.producto.findUniqueOrThrow({
      where: { id: productoId },
      include: {
        variantes: {
          where: { id: varianteId },
          include: { precios: { where: { listaPrecio, vigenteHasta: null }, take: 1 } },
        },
        // Solo tiene filas si el producto es COMBO — ver
        // FacturacionService.expandirParaInventario.
        componentes: { include: { componente: true } },
        // Ley fiscal aplicable (plan de integración Cuadre, ítem B-3) —
        // reduce el ITBIS efectivo, ver FacturacionService.calcularLineasYTotales.
        leyFiscal: { select: { porcentajeItbisAPagar: true } },
      },
    });
    const { variantes, ...resto } = producto;
    return { ...resto, precios: variantes[0]?.precios ?? [] };
  }

  /**
   * Toma el próximo NCF de forma atómica para el tipo dado.
   *
   * El incremento usa `{ increment: 1 }`, que Postgres ejecuta como
   * `UPDATE ... SET "secuenciaActual" = "secuenciaActual" + 1` — relativo
   * al valor de la fila EN ESE MOMENTO, bajo su lock de fila, no al valor
   * que leyó el `findFirstOrThrow` de arriba. Es lo que hace esto seguro
   * bajo concurrencia: si dos facturas piden NCF a la vez, Postgres
   * serializa los dos `UPDATE` de esa misma fila (uno espera a que el otro
   * termine su transacción) y cada uno incrementa desde el valor ya
   * actualizado por el anterior — nunca desde el mismo valor leído dos
   * veces. La versión anterior calculaba `secuenciaActual + 1` en JS a
   * partir del valor leído, así que dos transacciones concurrentes podían
   * leer el mismo valor y escribir el mismo resultado: NCF duplicado, una
   * violación real de la norma DGII de unicidad/secuencialidad.
   */
  async siguienteNcf(tipoNcf: TipoNcf): Promise<string> {
    const { ncf } = await this.db.$transaction((tx) => this.siguienteNcfEnTx(tx, tipoNcf));
    return ncf;
  }

  /**
   * Cuerpo puro de `siguienteNcf` — ver `FacturacionService.crear`/
   * `crearFacturaEnTx`: participa en la misma transacción que el
   * descuento de stock y la creación de la factura. `sucursalId` (plan
   * de integración Cuadre, ítem B-2) intenta primero la secuencia propia
   * de esa sucursal y cae a la compartida (`sucursalId: null`) si no
   * existe — así un tenant sin secuencias por sucursal sigue funcionando
   * exactamente igual que antes.
   */
  async siguienteNcfEnTx(
    tx: Prisma.TransactionClient,
    tipoNcf: TipoNcf,
    sucursalId?: string | null,
  ): Promise<{ ncf: string; restantes: number; umbralAlerta: number | null; sucursalIdUsado: string | null }> {
    const secuencia =
      (sucursalId ? await tx.ncfAsignado.findFirst({ where: { tipoNcf, activo: true, sucursalId } }) : null) ??
      (await tx.ncfAsignado.findFirstOrThrow({ where: { tipoNcf, activo: true, sucursalId: null } }));
    const actualizada = await tx.ncfAsignado.update({
      where: { id: secuencia.id },
      data: { secuenciaActual: { increment: 1 } },
    });
    if (actualizada.secuenciaActual - 1 > actualizada.secuenciaFinal) {
      throw new Error(`Secuencia de NCF ${tipoNcf} agotada`);
    }
    return {
      ncf: `${tipoNcf}${String(actualizada.secuenciaActual - 1).padStart(8, '0')}`,
      restantes: actualizada.secuenciaFinal - (actualizada.secuenciaActual - 1),
      umbralAlerta: actualizada.umbralAlerta,
      sucursalIdUsado: actualizada.sucursalId,
    };
  }

  crearFactura(params: Parameters<FacturacionRepository['crearFacturaEnTx']>[1]) {
    return this.db.$transaction((tx) => this.crearFacturaEnTx(tx, params));
  }

  /**
   * `crearFactura` es un solo `create` — no necesitaba transacción propia
   * antes de esto, pero ahora participa en la transacción de
   * `FacturacionService.crear` (junto al descuento de stock y el consumo
   * de NCF) para que las tres cosas sean todo-o-nada. Un fallo en
   * cualquiera de las tres deja de dejar a las otras dos ya confirmadas
   * (stock descontado sin factura, NCF consumido sin factura, etc.).
   */
  crearFacturaEnTx(
    tx: Prisma.TransactionClient,
    params: {
      // Fase 5b — pre-generado por FacturacionService.crear() ANTES de la
      // transacción, para que el descuento/reintegro de stock (que corre
      // antes de este create) pueda referenciar esta factura en cada
      // movimiento de lote (`referenciaId`). Prisma acepta sobreescribir el
      // `@default(uuid())` pasando el id explícito.
      id?: string;
      tenantId: string;
      // Número interno de empresa, distinto del NCF — ver
      // FacturacionService.crear().
      numero: string;
      clienteId: string;
      vendedorId: string;
      bodegaId: string;
      tipoFactura: TipoFactura;
      ncf?: string;
      tipoNcf?: TipoNcf;
      facturaOrigenId?: string;
      // Solo lo llenan las ventas de POS — ver PosService.registrarVenta.
      // formaPagoId/referenciaPago acá son ya la "forma de pago principal"
      // (mayor monto) resuelta por FacturacionService.crear — para lectura
      // rápida/reportes. La fuente de verdad del arqueo es `pagos` (abajo).
      formaPagoId?: string;
      referenciaPago?: string;
      turnoCajaId?: string;
      vendedorEmpleadoId?: string;
      // Ledger de PagoVenta a crear junto a la factura — soporta pago
      // dividido (varias formas de pago en una misma venta). Vacío/omitido
      // para facturación que no es de POS (crédito sin pago inmediato).
      pagos?: { formaPagoId: string; monto: number; referencia?: string }[];
      // Condición de pago (plan de integración Cuadre, ítem B-6) — sin
      // enviar, cae al @default(30) del schema. Ya consumido por
      // RecordatoriosService (fecha + plazoPagoDias) desde antes de este
      // ítem; lo que faltaba era poder ELEGIRLO al crear la factura.
      plazoPagoDias?: number;
      subtotal: number;
      descuento: number;
      itbis: number;
      total: number;
      // Ítem C-2 (multi-moneda) — puramente de presentación, ver
      // FacturacionService.resolverMoneda.
      moneda?: string;
      tasaCambio?: number;
      subtotalMoneda?: number;
      itbisMoneda?: number;
      totalMoneda?: number;
      lineas: LineaCalculada[];
      // Ítem B-4 — ya incluidos en `itbis`/`total` de arriba, calculados
      // por FacturacionService.crear() antes de llamar acá.
      recargos?: { concepto: string; monto: number; gravado: boolean }[];
    },
  ) {
    return tx.factura.create({
      data: {
        id: params.id,
        tenantId: params.tenantId,
        numero: params.numero,
        clienteId: params.clienteId,
        vendedorId: params.vendedorId,
        bodegaId: params.bodegaId,
        tipoFactura: params.tipoFactura,
        ncf: params.ncf,
        tipoNcf: params.tipoNcf,
        facturaOrigenId: params.facturaOrigenId,
        formaPagoId: params.formaPagoId,
        referenciaPago: params.referenciaPago,
        turnoCajaId: params.turnoCajaId,
        vendedorEmpleadoId: params.vendedorEmpleadoId,
        plazoPagoDias: params.plazoPagoDias,
        estado: 'EMITIDA',
        subtotal: params.subtotal,
        descuento: params.descuento,
        itbis: params.itbis,
        total: params.total,
        moneda: params.moneda,
        tasaCambio: params.tasaCambio,
        subtotalMoneda: params.subtotalMoneda,
        itbisMoneda: params.itbisMoneda,
        totalMoneda: params.totalMoneda,
        lineas: {
          create: params.lineas.map((linea) => ({
            productoId: linea.productoId,
            varianteId: linea.varianteId,
            descripcionManual: linea.descripcionManual,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
            descuento: linea.descuento,
            porcentajeItbis: linea.porcentajeItbis,
            montoItbis: linea.montoItbis,
            montoTotal: linea.montoTotal,
            pagaComision: linea.pagaComision,
          })),
        },
        ...(params.pagos?.length
          ? {
              pagosVenta: {
                create: params.pagos.map((p) => ({ formaPagoId: p.formaPagoId, monto: p.monto, referencia: p.referencia })),
              },
            }
          : {}),
        ...(params.recargos?.length
          ? {
              recargos: {
                create: params.recargos.map((r, i) => ({ concepto: r.concepto, monto: r.monto, gravado: r.gravado, orden: i })),
              },
            }
          : {}),
      },
      include: { lineas: true },
    });
  }

  buscarPorId(id: string) {
    return this.db.factura.findUniqueOrThrow({
      where: { id },
      include: {
        lineas: { include: { producto: { include: { componentes: { include: { componente: true } } } } } },
        recargos: { orderBy: { orden: 'asc' } },
        cliente: true,
        // Necesario para anular(): si ya se emitieron notas de crédito
        // parciales contra esta factura, solo hay que reintegrar lo que
        // aún no se había devuelto (ver FacturacionService.anular).
        notasRelacionadas: { where: { tipoFactura: 'NOTA_CREDITO', estado: 'EMITIDA' }, include: { lineas: true } },
        // Necesario para anular(): un Cajero (sin pos.supervisar) solo puede
        // anular ventas de SU propio turno mientras sigue abierto.
        turnoCaja: { select: { cajeroId: true, estado: true } },
      },
    });
  }

  listar(params: { skip?: number; take?: number; busqueda?: string; tiposFactura?: TipoFactura[] }) {
    const where = {
      ...(params.busqueda
        ? {
            OR: [
              { ncf: { contains: params.busqueda, mode: 'insensitive' as const } },
              { cliente: { nombre: { contains: params.busqueda, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
      ...(params.tiposFactura?.length ? { tipoFactura: { in: params.tiposFactura } } : {}),
    };
    return Promise.all([
      this.db.factura.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { cliente: true },
      }),
      this.db.factura.count({ where }),
    ]);
  }

  /** Ver `crearFacturaEnTx` — participa en la misma transacción que la reintegración de stock de `FacturacionService.anular`. */
  anularEnTx(tx: Prisma.TransactionClient, id: string, motivo: string) {
    return tx.factura.update({
      where: { id },
      data: { estado: 'ANULADA', motivoAnulacion: motivo },
      include: { lineas: true },
    });
  }
}
