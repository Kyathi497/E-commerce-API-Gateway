import { describe, expect, it } from "vitest";
import { findRoute, isImageUpload, underPrefix } from "./routes.js";

describe("routing", () => {
  it("matches whole path segments only", () => {
    expect(underPrefix("/api/v1/me", "/api/v1/me")).toBe(true);
    expect(underPrefix("/api/v1/me/addresses", "/api/v1/me")).toBe(true);
    expect(underPrefix("/api/v1/meals", "/api/v1/me")).toBe(false);
  });

  it("sends auth, profile and admin user paths to auth-service", () => {
    for (const path of ["/api/v1/auth/login", "/api/v1/me", "/api/v1/me/addresses/1", "/api/v1/admin/users/abc"]) {
      expect(findRoute(path)?.prefix, path).toBeDefined();
    }
  });

  it("sends catalog, stock and photo paths to their services", () => {
    const cases: [string, string][] = [
      ["/api/v1/products", "http://localhost:4002"],
      ["/api/v1/products/turmeric-powder", "http://localhost:4002"],
      ["/api/v1/bundles/gift-hamper", "http://localhost:4002"],
      ["/api/v1/admin/skus/abc", "http://localhost:4002"],
      ["/api/v1/admin/events/catalog/deliveries", "http://localhost:4002"],
      ["/media/products/turmeric/x-800.webp", "http://localhost:4002"],
      ["/api/v1/availability", "http://localhost:4003"],
      ["/api/v1/admin/stock/abc/receive", "http://localhost:4003"],
      ["/api/v1/admin/events/inventory/deliveries", "http://localhost:4003"],
    ];
    for (const [path, target] of cases) expect(findRoute(path)?.target, path).toBe(target);
  });

  it("sends cart, promotion and shipping paths to their services", () => {
    const cases: [string, string][] = [
      ["/api/v1/cart", "http://localhost:4004"],
      ["/api/v1/cart/items/p:TURM-1KG", "http://localhost:4004"],
      ["/api/v1/cart/coupon", "http://localhost:4004"],
      ["/api/v1/offers", "http://localhost:4005"],
      ["/api/v1/admin/coupons/abc/redemptions", "http://localhost:4005"],
      ["/api/v1/admin/promotions", "http://localhost:4005"],
      ["/api/v1/shipping/serviceability", "http://localhost:4008"],
      ["/api/v1/admin/shipping/rules", "http://localhost:4008"],
    ];
    for (const [path, target] of cases) expect(findRoute(path)?.target, path).toBe(target);
  });

  it("sends order and payment paths to their services, webhooks included", () => {
    const cases: [string, string][] = [
      ["/api/v1/checkout", "http://localhost:4006"],
      ["/api/v1/orders/TEJ-26-000001", "http://localhost:4006"],
      ["/api/v1/orders/track", "http://localhost:4006"],
      ["/api/v1/admin/orders/export.csv", "http://localhost:4006"],
      ["/api/v1/payments/verify", "http://localhost:4007"],
      ["/api/v1/webhooks/razorpay", "http://localhost:4007"],
      ["/api/v1/admin/payments/abc/refunds", "http://localhost:4007"],
      ["/api/v1/admin/events/payment/deliveries", "http://localhost:4007"],
    ];
    for (const [path, target] of cases) expect(findRoute(path)?.target, path).toBe(target);
    expect(findRoute("/api/v1/webhooks/shiprocket")).toBeUndefined();
  });

  it("recognises only the photo upload as multipart", () => {
    expect(isImageUpload("POST", "/api/v1/admin/products/abc/images")).toBe(true);
    expect(isImageUpload("POST", "/api/v1/admin/products/abc/images/def")).toBe(false);
    expect(isImageUpload("PATCH", "/api/v1/admin/products/abc/images")).toBe(false);
  });

  it("never routes internal or unknown paths", () => {
    expect(findRoute("/internal/.well-known/jwks.json")).toBeUndefined();
    expect(findRoute("/api/v1/internal/.well-known/jwks.json")).toBeUndefined();
    expect(findRoute("/api/v1/admin/returns")).toBeUndefined();
    expect(findRoute("/internal/payments")).toBeUndefined();
    expect(findRoute("/internal/events")).toBeUndefined();
    expect(findRoute("/internal/price-lines")).toBeUndefined();
    expect(findRoute("/internal/promotions/evaluate")).toBeUndefined();
    expect(findRoute("/internal/shipping/quote")).toBeUndefined();
    expect(findRoute("/api/v1/carts")).toBeUndefined();
    expect(findRoute("/api/v1/admin/events")).toBeUndefined();
  });
});
