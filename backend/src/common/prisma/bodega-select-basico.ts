import type { Bodega, Prisma } from '@prisma/client';
import type { SerializadoHttp } from './serializado-http';

/**
 * `Bodega` no tiene campos sensibles — a diferencia de Cliente/Pago, acá
 * no hay hallazgo de seguridad, solo de consistencia de tipos: la
 * auditoría de estructura del frontend encontró 8 declaraciones
 * independientes de esta misma entidad (Inventario, POS, Conteos,
 * Cotizaciones, Remisiones, Turnos de Caja), cada una con un subconjunto
 * de campos distinto y sin relación estructural entre sí.
 */
export type BodegaBasica = SerializadoHttp<Bodega>;

/** `InventarioRepository.listarTodasBodegas()` — pantalla de gestión de bodegas, incluye el nombre de la sucursal. */
export const INCLUDE_BODEGA_CON_SUCURSAL = {
  sucursal: { select: { nombre: true } },
} satisfies Prisma.BodegaInclude;

export type BodegaConSucursal = SerializadoHttp<Prisma.BodegaGetPayload<{ include: typeof INCLUDE_BODEGA_CON_SUCURSAL }>>;
