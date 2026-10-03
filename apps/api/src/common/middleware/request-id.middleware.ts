import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

/**
 * Assigns a correlation/request id to every request, exposed as
 * `req.requestId` and the `x-request-id` response header. Used in
 * error responses and audit logs.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    const incoming = req.headers["x-request-id"];
    const requestId =
      typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  }
}
