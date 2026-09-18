import type { Prisma } from '@prisma/client';
import type { SerializadoHttp } from './serializado-http';

/**
 * `select` mínimo de `Cliente` para incluir en facturas/cotizaciones/
 * remisiones/reportes/notificaciones — nunca `include: { cliente: true }`
 * a secas (hallazgo Alto de auditoría: sin `select`, Prisma trae TODOS
 * los campos escalares, incluido `passwordHash` de la cuenta de Tienda
 * Online del cliente, hasta el frontend).
 *
 * `satisfies Prisma.ClienteSelect` ata este literal al modelo real: si
 * `Cliente` pierde/renombra un campo en schema.prisma, esto deja de
 * compilar acá mismo. `ClienteBasico` es el tipo resultante — el
 * frontend lo importa (solo como tipo, vía el alias `@backend-src/*` de
 * `frontend/tsconfig.json`) para tipar el campo `cliente` de Factura/
 * Cotización/Remisión contra la forma real, en vez de copiarla a mano
 * (hallazgo Medio de la auditoría de comunicación frontend-backend).
 */
export const CLIENTE_SELECT_BASICO = {
  id: true,
  nombre: true,
  rncCedula: true,
  email: true,
  telefono: true,
} satisfies Prisma.ClienteSelect;

export type ClienteBasico = SerializadoHttp<Prisma.ClienteGetPayload<{ select: typeof CLIENTE_SELECT_BASICO }>>;
