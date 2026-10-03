import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ApiErrorCode } from "../errors/error-codes";

/**
 * Renders every thrown error as the contract's ErrorResponse shape:
 *   { "code": "...", "message": "...", "details": {...}, "requestId": "..." }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();
    const requestId = req.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = "INTERNAL_ERROR";
    let message = "Terjadi kesalahan pada server.";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        if (typeof b.code === "string") code = b.code;
        if (typeof b.message === "string") message = b.message;
        if (b.details && typeof b.details === "object") {
          details = b.details as Record<string, unknown>;
        }
      } else if (typeof body === "string") {
        message = body;
      }
    } else {
      this.logger.error(
        `Unhandled error [${requestId}]: ${String((exception as Error)?.stack ?? exception)}`,
      );
    }

    // Map Prisma unique-constraint violations to 409 when they leak through.
    if (code === "INTERNAL_ERROR" && isPrismaKnownError(exception, "P2002")) {
      status = HttpStatus.CONFLICT;
      code = ApiErrorCode.RESOURCE_CONFLICT;
      message = "Data sudah ada (duplikat tidak diizinkan).";
    }

    const payload: Record<string, unknown> = { code, message };
    if (details !== undefined) payload.details = details;
    if (requestId) payload.requestId = requestId;

    res.status(status).json(payload);
  }
}

function isPrismaKnownError(exception: unknown, code: string): boolean {
  return (
    typeof exception === "object" &&
    exception !== null &&
    (exception as { code?: string }).code === code
  );
}
