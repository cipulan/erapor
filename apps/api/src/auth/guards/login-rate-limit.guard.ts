import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { HttpException, HttpStatus } from "@nestjs/common";
import { Request } from "express";
import { APP_CONFIG, AppConfig } from "../../config/configuration";
import { IS_PUBLIC_KEY } from "../../common/decorators/roles.decorator";
import { ApiErrorCode } from "../../common/errors/error-codes";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter for POST /auth/login (per IP + email).
 * Responds 429 when the budget is exceeded. Not a distributed limiter —
 * sufficient for the single-instance MVP deployment.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Only applied explicitly on the login route; stay inert elsewhere.
    const handler = context.getHandler();
    if (!isPublic || handler.name !== "login") return true;

    const req = context.switchToHttp().getRequest<Request>();
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    const key = `${req.ip ?? "unknown"}:${email}`;
    const now = Date.now();
    const windowMs = this.config.loginRateLimitWindowMs;
    const max = this.config.loginRateLimitMax;

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Opportunistic cleanup.
    if (this.buckets.size > 10_000) {
      for (const [k, b] of this.buckets) {
        if (b.resetAt <= now) this.buckets.delete(k);
      }
    }

    if (bucket.count > max) {
      throw new HttpException(
        {
          code: ApiErrorCode.RATE_LIMITED,
          message: "Terlalu banyak percobaan login. Coba lagi beberapa saat.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
