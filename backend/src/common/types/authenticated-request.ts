import { Request } from 'express';

export interface JwtPayloadUser {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  permisos: string[];
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayloadUser;
}
