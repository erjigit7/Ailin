import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUser } from './jwt.strategy';

/** Достаёт текущего пользователя (из JWT) в аргумент метода контроллера. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
