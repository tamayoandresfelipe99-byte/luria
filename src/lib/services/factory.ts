import "server-only";
import { assertSafeConfig, loadConfig, type AppConfig } from "../config";
import { createWompiProvider } from "../payments/wompi";
import { createMockProvider } from "../payments/mock";
import type { PaymentProvider } from "../payments/types";
import { createHttpAdapter, createManualAdapter, createPendingAdapter, createSimulatedAdapter } from "../licensing/adapters";
import type { LicenseAdapter } from "../licensing/types";

let cfgCache: AppConfig | null = null;
export function appConfig(): AppConfig {
  if (!cfgCache) {
    cfgCache = loadConfig();
    assertSafeConfig(cfgCache); // A20: producción con piezas simuladas no arranca.
  }
  return cfgCache;
}

let providerCache: PaymentProvider | null = null;
export function paymentProvider(): PaymentProvider | null {
  const c = appConfig();
  if (providerCache) return providerCache;
  switch (c.paymentProvider) {
    case "wompi":
      if (!c.wompi.publicKey || !c.wompi.integritySecret || !c.wompi.eventsSecret) return null;
      providerCache = createWompiProvider(c.wompi);
      break;
    case "mock":
      providerCache = createMockProvider(c.appUrl);
      break;
    default:
      // mercadopago / payu: adaptador documentado (docs/pagos-comparativo.md), no implementado.
      return null;
  }
  return providerCache;
}

let licenseCache: LicenseAdapter | null = null;
export function licenseAdapter(): LicenseAdapter {
  if (licenseCache) return licenseCache;
  const c = appConfig();
  switch (c.licenseAdapter) {
    case "http":
      licenseCache = createHttpAdapter({ baseUrl: c.licenseApi.baseUrl, sharedSecret: c.licenseApi.sharedSecret });
      break;
    case "manual":
      licenseCache = c.licenseManualRevocationConfirmed ? createManualAdapter() : createPendingAdapter();
      break;
    case "simulated":
      licenseCache = createSimulatedAdapter();
      break;
    default:
      licenseCache = createPendingAdapter();
  }
  return licenseCache;
}
