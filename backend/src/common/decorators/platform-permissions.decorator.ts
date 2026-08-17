import { SetMetadata } from '@nestjs/common';

export const PLATFORM_PERMISSIONS_KEY = 'platform_permisos_requeridos';
export const PlatformPermissions = (...permisos: string[]) => SetMetadata(PLATFORM_PERMISSIONS_KEY, permisos);
