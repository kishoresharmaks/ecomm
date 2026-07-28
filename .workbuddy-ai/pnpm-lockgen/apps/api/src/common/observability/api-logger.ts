import { Injectable, type LoggerService } from "@nestjs/common";
import pino, { type Logger } from "pino";
import { currentRequestContext } from "./request-context";
import { redactSensitive } from "./redaction";

export const apiLogger: Logger = pino({
  name: "indihub-api",
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "indihub-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "authorization",
      "cookie",
      "password",
      "token",
      "secret",
      "*.password",
      "*.token",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
  serializers: { err: pino.stdSerializers.err },
});

@Injectable()
export class PinoNestLogger implements LoggerService {
  log(message: unknown, context?: string) {
    apiLogger.info(this.fields(context), this.message(message));
  }
  error(message: unknown, trace?: string, context?: string) {
    apiLogger.error(
      { ...this.fields(context), trace: trace ? "[available]" : undefined },
      this.message(message),
    );
  }
  warn(message: unknown, context?: string) {
    apiLogger.warn(this.fields(context), this.message(message));
  }
  debug(message: unknown, context?: string) {
    apiLogger.debug(this.fields(context), this.message(message));
  }
  verbose(message: unknown, context?: string) {
    apiLogger.trace(this.fields(context), this.message(message));
  }
  fatal(message: unknown, trace?: string, context?: string) {
    apiLogger.fatal(
      { ...this.fields(context), trace: trace ? "[available]" : undefined },
      this.message(message),
    );
  }
  private message(message: unknown) {
    return typeof message === "string"
      ? String(redactSensitive(message))
      : "structured_log_event";
  }

  private fields(context?: string) {
    return { context, ...currentRequestContext() };
  }
}
