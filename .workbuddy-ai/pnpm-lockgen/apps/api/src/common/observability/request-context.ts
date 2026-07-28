import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type RequestContext = {
  requestId: string;
  correlationId: string;
  startedAt: number;
};

const storage = new AsyncLocalStorage<RequestContext>();
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function currentRequestContext() {
  return storage.getStore();
}

export function normalizeTraceIdentifier(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return safeIdentifier.test(trimmed) ? trimmed : undefined;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = normalizeTraceIdentifier(req.header("x-request-id")) ?? randomUUID();
  const correlationId =
    normalizeTraceIdentifier(req.header("x-correlation-id")) ?? requestId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);
  storage.run({ requestId, correlationId, startedAt: Date.now() }, next);
}
