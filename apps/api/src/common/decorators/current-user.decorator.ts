import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { SessionUser } from "../../auth/types/session-user";

/** Extracts the authenticated session user attached by SessionAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as SessionUser;
  },
);
