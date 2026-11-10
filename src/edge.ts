import { extractToken, type TokenVerifier } from "./lib/auth-guard/index.js";
import type { NextFunction, Request, Response } from "express";
import { ADMIN_PREFIX, isImageUpload, MEDIA_PREFIX, underPrefix } from "./routes.js";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Webhooks come from Razorpay/Shiprocket servers, not browsers.
export const isWebhook = (path: string) => underPrefix(path, "/api/v1/webhooks");

const fail = (req: Request, res: Response, status: number, code: string, error: string) =>
  res.status(status).json({ error, code, requestId: req.requestId });

// CSRF, second layer (§10): a write carrying an Origin must come from our own site.
export function originCheck(allowed: string[]) {
  const allow = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    if (!UNSAFE.has(req.method) || !origin || isWebhook(req.path) || allow.has(origin)) return next();
    fail(req, res, 403, "BAD_ORIGIN", "Invalid request.");
  };
}

// Rejects oversized bodies before they reach a service (§6.1). Only the
// admin photo upload may send more than maxBytes.
export function bodyLimit(maxBytes: number, uploadBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const length = Number(req.header("content-length") ?? 0);
    const limit = isImageUpload(req.method, req.path) ? uploadBytes : maxBytes;
    if (length > limit) return fail(req, res, 413, "PAYLOAD_TOO_LARGE", "That request is too large.");
    next();
  };
}

// The photo upload is the one write that isn't JSON; it must be multipart.
export const skipJsonCheck = (path: string) => isWebhook(path) || isImageUpload("POST", path);

export function uploadType(req: Request, res: Response, next: NextFunction) {
  if (!isImageUpload(req.method, req.path)) return next();
  const type = (req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type === "multipart/form-data") return next();
  fail(req, res, 415, "UNSUPPORTED_MEDIA_TYPE", "Invalid request.");
}

// Product photos are read-only from outside.
export function mediaReadOnly(req: Request, res: Response, next: NextFunction) {
  if (!underPrefix(req.path, MEDIA_PREFIX) || req.method === "GET" || req.method === "HEAD") return next();
  fail(req, res, 405, "METHOD_NOT_ALLOWED", "Invalid request.");
}

// Verifies the access token against auth's JWKS and passes the identity on as
// x-user-id / x-user-role (§6.1). Services verify the token again themselves;
// these headers are for logs and tracing. Callers can't set them: incoming
// copies are always removed. /admin/* is refused here unless role = admin.
export function authenticate(verifier: TokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    delete req.headers["x-user-id"];
    delete req.headers["x-user-role"];

    const token = extractToken(req);
    if (token) {
      try {
        req.user = await verifier.verify(token);
        req.headers["x-user-id"] = req.user.id;
        req.headers["x-user-role"] = req.user.role;
      } catch {
        // Expired or invalid: pass through unauthenticated; the service answers 401.
      }
    }

    if (underPrefix(req.path, ADMIN_PREFIX)) {
      if (!req.user) return fail(req, res, 401, "UNAUTHENTICATED", "Please log in to continue.");
      if (req.user.role !== "admin") return fail(req, res, 403, "FORBIDDEN", "You don't have access to this.");
    }
    next();
  };
}
