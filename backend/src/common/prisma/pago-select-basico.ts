import type { Prisma } from '@prisma/client';
import type { SerializadoHttp } from './serializado-http';

/**
 * `Pago` (tenant-scoped) sirve tanto a cobros de Factura como a pagos de
 * OrdenCompra (`facturaId`/`ordenCompraId` mutuamente excluyentes, ver
 * schema.prisma) — un solo `include` compartido entre
 * `PagosRepository.listarPorFactura`/`.listarPorOrdenCompra`/`.crear` y
 * las 3 interfaces `Pago` que antes se repetían a mano en el frontend
 * (FacturasTable, ModalRegistrarCobro, ModalRegistrarPagoOrdenCompra).
 */
export const INCLUDE_PAGO_BASICO = {
  formaPago: { select: { nombre: true } },
} satisfies Prisma.PagoInclude;

export type PagoBasico = SerializadoHttp<Prisma.PagoGetPayload<{ include: typeof INCLUDE_PAGO_BASICO }>>;
