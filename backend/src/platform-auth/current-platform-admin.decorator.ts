import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPlatformRequest } from './platform-authenticated-request';

export const CurrentPlatformAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedPlatformRequest>();
  return request.user;
});
