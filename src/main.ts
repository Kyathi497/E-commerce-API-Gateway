import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { TokenVerifier } from "./lib/auth-guard/index.js";
import {
  createLogger,
  HealthModule,
  HttpErrorFilter,
  PinoNestLogger,
  requestId,
  requestLogger,
  requireJson,
} from "./lib/common/index.js";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import helmet from "helmet";
import { Redis } from "ioredis";
import { config, jwksUrl } from "./config.js";
import { authenticate, bodyLimit, mediaReadOnly, originCheck, skipJsonCheck, uploadType } from "./edge.js";
import { apiProxy } from "./proxy.js";
import { rateLimiter } from "./rate-limit.js";
import { API_PREFIX, findRoute, underPrefix } from "./routes.js";

const logger = createLogger("api-gateway");

// Fail fast when Redis is down instead of queueing commands (the rate limiter fails open).
const redis = new Redis(config.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1, commandTimeout: 500 });
let lastRedisError = 0;
redis.on("error", (err) => {
  if (Date.now() - lastRedisError < 60_000) return;
  lastRedisError = Date.now();
  logger.warn({ err }, "redis connection error");
});

@Module({
  imports: [HealthModule.register({ useFactory: () => ({ redis: () => redis.ping() }) })],
})
class AppModule {}

// Gateway middleware applies to /api/v1/* only; /health stays cheap.
const api =
  (mw: RequestHandler): RequestHandler =>
  (req, res, next) =>
    underPrefix(req.path, API_PREFIX) ? mw(req, res, next) : next();

function unknownRoute(req: Request, res: Response, next: NextFunction) {
  if (findRoute(req.path)) return next();
  res.status(404).json({ error: "We couldn't find that.", code: "NOT_FOUND", requestId: req.requestId });
}

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  bodyParser: false,
  logger: new PinoNestLogger(logger),
});
app.set("trust proxy", process.env.TRUST_PROXY ?? "loopback, linklocal, uniquelocal");
app.disable("x-powered-by");
app.use(requestId());
app.use(requestLogger(logger));
app.use(helmet());
app.enableCors({ origin: config.FRONTEND_ORIGINS, credentials: true });
app.use(api(originCheck(config.FRONTEND_ORIGINS)));
app.use(api(bodyLimit(config.MAX_BODY_BYTES, config.MAX_UPLOAD_BYTES)));
app.use(api(requireJson(skipJsonCheck)));
app.use(api(uploadType));
app.use(api(rateLimiter(redis, logger)));
app.use(api(authenticate(new TokenVerifier({ jwksUrl }))));
app.use(api(unknownRoute));
app.use(mediaReadOnly);
app.use(apiProxy(logger));
app.useGlobalFilters(new HttpErrorFilter(logger));
app.enableShutdownHooks();

await app.listen(config.PORT, "0.0.0.0");
logger.info({ port: config.PORT }, "api-gateway listening");

process.once("SIGTERM", () => void redis.quit());
