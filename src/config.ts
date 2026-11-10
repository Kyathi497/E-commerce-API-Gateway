import { envList, loadConfig, nodeEnv } from "./lib/common/index.js";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: nodeEnv,
  PORT: z.coerce.number().int().default(4000),
  // Origins allowed to make cookie-authenticated writes and CORS requests.
  FRONTEND_ORIGINS: envList(["http://localhost:3000"]),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  AUTH_SERVICE_URL: z.url().default("http://localhost:4001"),
  AUTH_JWKS_URL: z.url().optional(),
  CATALOG_SERVICE_URL: z.url().default("http://localhost:4002"),
  INVENTORY_SERVICE_URL: z.url().default("http://localhost:4003"),
  CART_SERVICE_URL: z.url().default("http://localhost:4004"),
  PROMOTION_SERVICE_URL: z.url().default("http://localhost:4005"),
  ORDER_SERVICE_URL: z.url().default("http://localhost:4006"),
  PAYMENT_SERVICE_URL: z.url().default("http://localhost:4007"),
  SHIPPING_SERVICE_URL: z.url().default("http://localhost:4008"),

  // Requests per minute (§6.1).
  RATE_LIMIT_GENERAL: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(5),
  // Coupon tries per minute per IP, so codes can't be guessed (§10).
  RATE_LIMIT_COUPON: z.coerce.number().int().positive().default(10),
  // Checkouts per minute per IP, and guest order lookups (§10).
  RATE_LIMIT_CHECKOUT: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_TRACK: z.coerce.number().int().positive().default(10),
  MAX_BODY_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  // Admin product photo uploads only (§6.1): 5 MB file plus form overhead.
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024 + 64 * 1024),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export const config = loadConfig(schema);
export const jwksUrl = config.AUTH_JWKS_URL ?? `${config.AUTH_SERVICE_URL}/internal/.well-known/jwks.json`;
