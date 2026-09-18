import type { Prisma } from '@prisma/client';

/**
 * Un tipo derivado de Prisma (`Prisma.XxxGetPayload<...>`) describe la
 * forma tal como vive en el proceso del backend, con `Decimal`/`Date`
 * como objetos reales — no la forma que en verdad recibe el frontend
 * después de que Nest serializa la respuesta a JSON (ambos se vuelven
 * `string`, vía `Decimal.toJSON()`/`Date.toJSON()`). Sin este mapeo, un
 * tipo "compartido" mentiría sobre la forma real que le llega al
 * frontend — peor que no compartir nada.
 */
export type SerializadoHttp<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? SerializadoHttp<U>[]
      : T extends object
        ? { [K in keyof T]: SerializadoHttp<T[K]> }
        : T;
