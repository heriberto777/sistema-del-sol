import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedClienteTiendaRequest } from './cliente-tienda-authenticated-request';

export const CurrentClienteTienda = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedClienteTiendaRequest>();
  return request.user;
});
