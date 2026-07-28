import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { catchError, tap, throwError } from "rxjs";
import { apiLogger } from "./api-logger";
import { currentRequestContext } from "./request-context";
import { redactSensitive } from "./redaction";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const startedAt = Date.now();
    const base = () => ({
      ...currentRequestContext(),
      method: req.method,
      route: req.route?.path ?? req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });

    return next.handle().pipe(
      tap(() => apiLogger.info(base(), "http.request.completed")),
      catchError((error: unknown) => {
        apiLogger.error({ ...base(), error: redactSensitive(error) }, "http.request.failed");
        return throwError(() => error);
      }),
    );
  }
}
