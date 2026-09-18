import type { Prisma } from '@prisma/client';
import type { SerializadoHttp } from './serializado-http';

/**
 * `PagoPlataforma` — modelo aparte de `Pago` (tenant-scoped): son los
 * pagos que un tenant hace a LA PLATAFORMA por su suscripción, nunca se
 * unifican con `Pago`/`PagoBasico` aunque el shape se parezca.
 */
export const INCLUDE_PAGO_PLATAFORMA_BASICO = {
  registradoPor: { select: { nombre: true } },
} satisfies Prisma.PagoPlataformaInclude;

export type PagoPlataformaBasico = SerializadoHttp<Prisma.PagoPlataformaGetPayload<{ include: typeof INCLUDE_PAGO_PLATAFORMA_BASICO }>>;
