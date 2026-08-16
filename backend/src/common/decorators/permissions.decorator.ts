import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permisos_requeridos';
export const Permissions = (...permisos: string[]) => SetMetadata(PERMISSIONS_KEY, permisos);
