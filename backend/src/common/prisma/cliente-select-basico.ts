/**
 * `select` mínimo de `Cliente` para incluir en facturas/cotizaciones/
 * remisiones/reportes/notificaciones — nunca `include: { cliente: true }`
 * a secas (hallazgo Alto de auditoría: sin `select`, Prisma trae TODOS
 * los campos escalares, incluido `passwordHash` de la cuenta de Tienda
 * Online del cliente, hasta el frontend).
 */
export const CLIENTE_SELECT_BASICO = {
  id: true,
  nombre: true,
  rncCedula: true,
  email: true,
  telefono: true,
} as const;
