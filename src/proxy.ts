import type { ServerResponse } from "node:http";
import type { Logger } from "./lib/common/index.js";
import type { Request } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "./config.js";
import { API_PREFIX, findRoute, MEDIA_PREFIX, underPrefix } from "./routes.js";

// Streams requests to the owning service untouched (raw bodies stay intact
// for webhook signatures). Only paths in ROUTES are reachable; /internal/*
// and anything unknown never leave the gateway. /media/* (product photos) is
// read-only: anything but GET/HEAD is refused before it gets here.
export function apiProxy(logger: Logger) {
  return createProxyMiddleware<Request, ServerResponse>({
    pathFilter: (path) => {
      const p = path.split("?")[0]!;
      return underPrefix(p, API_PREFIX) || underPrefix(p, MEDIA_PREFIX);
    },
    router: (req) => findRoute(req.path)?.target,
    xfwd: true,
    proxyTimeout: config.UPSTREAM_TIMEOUT_MS,
    timeout: config.UPSTREAM_TIMEOUT_MS,
    on: {
      error: (err, req, res) => {
        logger.error({ err, requestId: req.requestId, path: req.path }, "upstream error");
        if (!("writeHead" in res) || res.headersSent) return;
        const timedOut = (err as NodeJS.ErrnoException).code === "ECONNRESET" || /timeout/i.test(err.message);
        res.writeHead(timedOut ? 504 : 503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "We couldn't reach this part of the store. Please try again in a minute.",
            code: "UPSTREAM_UNAVAILABLE",
            requestId: req.requestId,
          }),
        );
      },
    },
  });
}
