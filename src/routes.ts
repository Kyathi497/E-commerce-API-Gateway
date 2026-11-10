import { config } from "./config.js";

// Public path prefix → owning service (§6.1). Paths are forwarded unchanged;
// every service serves under /api/v1. New services add their rows here.
export const ROUTES: { prefix: string; target: string }[] = [
  { prefix: "/api/v1/auth", target: config.AUTH_SERVICE_URL },
  { prefix: "/api/v1/me", target: config.AUTH_SERVICE_URL },
  { prefix: "/api/v1/admin/users", target: config.AUTH_SERVICE_URL },

  { prefix: "/api/v1/products", target: config.CATALOG_SERVICE_URL },
  { prefix: "/api/v1/categories", target: config.CATALOG_SERVICE_URL },
  { prefix: "/api/v1/bundles", target: config.CATALOG_SERVICE_URL },
  { prefix: "/api/v1/admin/products", target: config.CATALOG_SERVICE_URL },
  { prefix: "/api/v1/admin/skus", target: config.CATALOG_SERVICE_URL },
  { prefix: "/api/v1/admin/categories", target: config.CATALOG_SERVICE_URL },
  { prefix: "/api/v1/admin/bundles", target: config.CATALOG_SERVICE_URL },
  { prefix: "/api/v1/admin/events/catalog", target: config.CATALOG_SERVICE_URL },
  // Product photos (§6.3), served by catalog-service from its media folder.
  { prefix: "/media", target: config.CATALOG_SERVICE_URL },

  { prefix: "/api/v1/availability", target: config.INVENTORY_SERVICE_URL },
  { prefix: "/api/v1/admin/stock", target: config.INVENTORY_SERVICE_URL },
  { prefix: "/api/v1/admin/reservations", target: config.INVENTORY_SERVICE_URL },
  { prefix: "/api/v1/admin/events/inventory", target: config.INVENTORY_SERVICE_URL },

  { prefix: "/api/v1/cart", target: config.CART_SERVICE_URL },

  { prefix: "/api/v1/offers", target: config.PROMOTION_SERVICE_URL },
  { prefix: "/api/v1/admin/coupons", target: config.PROMOTION_SERVICE_URL },
  { prefix: "/api/v1/admin/promotions", target: config.PROMOTION_SERVICE_URL },

  { prefix: "/api/v1/admin/events/promotion", target: config.PROMOTION_SERVICE_URL },

  { prefix: "/api/v1/checkout", target: config.ORDER_SERVICE_URL },
  { prefix: "/api/v1/orders", target: config.ORDER_SERVICE_URL },
  { prefix: "/api/v1/admin/orders", target: config.ORDER_SERVICE_URL },
  { prefix: "/api/v1/admin/events/order", target: config.ORDER_SERVICE_URL },

  { prefix: "/api/v1/payments", target: config.PAYMENT_SERVICE_URL },
  // Razorpay's servers post here; the signature is checked on the raw body.
  { prefix: "/api/v1/webhooks/razorpay", target: config.PAYMENT_SERVICE_URL },
  { prefix: "/api/v1/admin/payments", target: config.PAYMENT_SERVICE_URL },
  { prefix: "/api/v1/admin/events/payment", target: config.PAYMENT_SERVICE_URL },

  { prefix: "/api/v1/shipping", target: config.SHIPPING_SERVICE_URL },
  { prefix: "/api/v1/admin/shipping", target: config.SHIPPING_SERVICE_URL },
];

export const API_PREFIX = "/api/v1";
export const ADMIN_PREFIX = "/api/v1/admin";
export const MEDIA_PREFIX = "/media";

// The one multipart route: admin product photo uploads (§6.3).
export const isImageUpload = (method: string, path: string) =>
  method === "POST" && /^\/api\/v1\/admin\/products\/[^/]+\/images$/.test(path);

// Exact segment match: /api/v1/me and /api/v1/me/addresses, never /api/v1/meals.
export const underPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

export function findRoute(path: string) {
  return ROUTES.find((r) => underPrefix(path, r.prefix));
}
