import { randomUUID } from "node:crypto";
import type { Logger } from "./lib/common/index.js";
import type { NextFunction, Request, Response } from "express";
import type { Redis } from "ioredis";
import { config } from "./config.js";

export interface Rule {
  name: string;
  limit: number;
  windowMs: number;
  matches: (req: Request) => boolean;
  key: (req: Request) => string;
}

// Credential-guessing targets: tight per-IP limit (account lockout in
// auth-service covers per-account guessing).
const SENSITIVE_AUTH = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/google",
  "/api/v1/auth/google/test",
  "/api/v1/auth/password/forgot",
  "/api/v1/auth/password/reset",
  "/api/v1/auth/email/verify",
]);

export const RULES: Rule[] = [
  {
    name: "auth",
    limit: config.RATE_LIMIT_AUTH,
    windowMs: 60_000,
    matches: (req) => req.method === "POST" && SENSITIVE_AUTH.has(req.path),
    key: (req) => `auth:${req.ip}`,
  },
  {
    name: "coupon",
    limit: config.RATE_LIMIT_COUPON,
    windowMs: 60_000,
    matches: (req) => req.method === "POST" && req.path === "/api/v1/cart/coupon",
    key: (req) => `coupon:${req.ip}`,
  },
  {
    name: "checkout",
    limit: config.RATE_LIMIT_CHECKOUT,
    windowMs: 60_000,
    matches: (req) => req.method === "POST" && req.path === "/api/v1/checkout",
    key: (req) => `checkout:${req.ip}`,
  },
  {
    // Order number + phone guessing (§10).
    name: "track",
    limit: config.RATE_LIMIT_TRACK,
    windowMs: 60_000,
    matches: (req) => req.method === "POST" && req.path === "/api/v1/orders/track",
    key: (req) => `track:${req.ip}`,
  },
  {
    name: "general",
    limit: config.RATE_LIMIT_GENERAL,
    windowMs: 60_000,
    matches: () => true,
    key: (req) => `general:${req.ip}`,
  },
];

// Sliding-window log in a sorted set: drop entries older than the window,
// count what's left, add this request if under the limit. Atomic in Redis, so
// it holds across any number of gateway replicas.
const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
if redis.call('ZCARD', key) >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return math.max(1, tonumber(oldest[2]) + window - now)
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return 0
`;

export function rateLimiter(redis: Redis, logger: Logger, rules: Rule[] = RULES) {
  let lastWarning = 0;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const rule of rules) {
        if (!rule.matches(req)) continue;
        const waitMs = (await redis.eval(
          SLIDING_WINDOW,
          1,
          `rl:${rule.key(req)}`,
          Date.now(),
          rule.windowMs,
          rule.limit,
          randomUUID(),
        )) as number;
        if (waitMs > 0) {
          res.setHeader("Retry-After", Math.ceil(waitMs / 1000));
          res.status(429).json({
            error: "Too many tries. Please wait a minute and try again.",
            code: "RATE_LIMITED",
            requestId: req.requestId,
          });
          return;
        }
      }
    } catch (err) {
      // Fail open: Redis being down must not take the store down with it.
      if (Date.now() - lastWarning > 60_000) {
        lastWarning = Date.now();
        logger.warn({ err }, "rate limiter unavailable; allowing requests");
      }
    }
    next();
  };
}
