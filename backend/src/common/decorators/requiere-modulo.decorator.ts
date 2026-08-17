import { SetMetadata } from '@nestjs/common';

export const REQUIERE_MODULO_KEY = 'requiere_modulo';

/** Bloquea el controller/handler si el tenant actual no tiene esta clave de módulo activa — ver ModuloActivoGuard. */
export const RequiereModulo = (clave: string) => SetMetadata(REQUIERE_MODULO_KEY, clave);
