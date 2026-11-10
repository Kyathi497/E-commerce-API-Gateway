# api-gateway

Single entry point for the store (`/api/v1/*`): routing, auth check, rate limits. Port 4000.

## Run

```sh
docker network create tej-net   # once per machine
docker compose up --build       # gateway + Redis
```

Upstream services (auth-service, …) run from their own folders and are reached over `tej-net`.
Hot reload: `docker compose up redis`, then `pnpm install && pnpm dev` (uses `.env`, see `.env.example`).

## Shared code

`src/lib/common` and `src/lib/auth-guard` are shared libraries copied into this service. If you fix a bug in one,
make the same fix in every other service that has a copy.
