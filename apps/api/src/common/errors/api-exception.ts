import { HttpException, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "./error-codes";

export interface ApiErrorBody {
  code: ApiErrorCode | string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Domain exception carrying a machine-readable code plus an
 * Indonesian user-facing message. Thrown from services and guards;
 * rendered by HttpExceptionFilter.
 */
export class ApiException extends HttpException {
  readonly code: ApiErrorCode | string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode | string,
    message: string,
    httpStatus: number,
    details?: Record<string, unknown>,
  ) {
    const body: ApiErrorBody = { code, message };
    if (details !== undefined) body.details = details;
    super(body, httpStatus);
    this.code = code;
    this.details = details;
  }
}

const id = (msg: string) => msg; // user-facing messages are Indonesian by convention

export const Errors = {
  invalidCredentials: () =>
    new ApiException(
      ApiErrorCode.AUTH_INVALID_CREDENTIALS,
      id("Email atau password salah."),
      HttpStatus.UNAUTHORIZED,
    ),
  sessionExpired: () =>
    new ApiException(
      ApiErrorCode.AUTH_SESSION_EXPIRED,
      id("Sesi tidak valid atau sudah berakhir. Silakan login kembali."),
      HttpStatus.UNAUTHORIZED,
    ),
  forbidden: (message = "Akses ditolak. Anda tidak memiliki izin untuk aksi ini.") =>
    new ApiException(ApiErrorCode.AUTH_FORBIDDEN, id(message), HttpStatus.FORBIDDEN),
  notFound: (resource = "Data") =>
    new ApiException(
      ApiErrorCode.RESOURCE_NOT_FOUND,
      id(`${resource} tidak ditemukan.`),
      HttpStatus.NOT_FOUND,
    ),
  conflict: (code: ApiErrorCode, message: string, details?: Record<string, unknown>) =>
    new ApiException(code, id(message), HttpStatus.CONFLICT, details),
  validation: (code: ApiErrorCode, message: string, details?: Record<string, unknown>) =>
    new ApiException(code, id(message), HttpStatus.UNPROCESSABLE_ENTITY, details),
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new ApiException(ApiErrorCode.VALIDATION_ERROR, id(message), HttpStatus.BAD_REQUEST, details),
};
