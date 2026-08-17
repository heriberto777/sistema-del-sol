import { Request } from 'express';

export interface PlatformAdminPayload {
  adminId: string;
  email: string;
  permisos: string[];
}

// Passport siempre asigna el resultado de la estrategia a `request.user`
// sin importar el nombre de la estrategia — por eso reutiliza esa misma
// propiedad (no `request.platformAdmin`). Nunca colisiona en runtime con
// AuthenticatedRequest de tenants: una ruta de plataforma jamás pasa por
// JwtAuthGuard (van marcadas @Public() y protegidas aparte con
// PlatformAuthGuard), así que jamás conviven en el mismo request.
export interface AuthenticatedPlatformRequest extends Request {
  user: PlatformAdminPayload;
}
