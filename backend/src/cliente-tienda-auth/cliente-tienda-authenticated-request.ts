import { Request } from 'express';

export interface ClienteTiendaPayload {
  clienteId: string;
  tenantId: string;
  email: string;
}

// Passport siempre asigna el resultado de la estrategia a `request.user`
// sin importar el nombre de la estrategia — por eso reutiliza esa misma
// propiedad (no `request.clienteTienda`). Nunca colisiona en runtime con
// AuthenticatedRequest de tenants ni con AuthenticatedPlatformRequest: una
// ruta de storefront jamás pasa por JwtAuthGuard (van marcadas @Public()),
// así que nunca conviven en el mismo request.
export interface AuthenticatedClienteTiendaRequest extends Request {
  user: ClienteTiendaPayload;
}
