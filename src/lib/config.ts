/**
 * Configuración operativa y compuertas de producción.
 * Regla: el prototipo nunca se detiene por dependencias pendientes, pero los cobros reales
 * y las acciones de producción se bloquean mientras falten condiciones indispensables.
 * Este módulo solo se usa en el servidor.
 */

export type AppEnv = "development" | "test" | "production";

export interface AppConfig {
  appEnv: AppEnv;
  appUrl: string;
  brandName: string;
  paymentProvider: "wompi" | "mercadopago" | "payu" | "mock" | "";
  wompi: { environment: "sandbox" | "production"; publicKey: string; integritySecret: string; eventsSecret: string };
  licenseAdapter: "pending" | "manual" | "http" | "simulated";
  licenseManualRevocationConfirmed: boolean;
  licenseApi: { baseUrl: string; sharedSecret: string };
  licenseTokenPrivateKey: string;
  licenseTokenTtlHours: number;
  renewalMode: "manual" | "automatic" | "";
  sellerIdentity: string;
  supportWhatsapp: string;
  extensionInstallUrl: string;
  activationSlaHours: number | null;
  legalTextsApproved: boolean;
  priceTaxTreatmentReviewed: boolean;
  supportedEnvironmentsVerified: boolean;
  cronSecret: string;
}

const bool = (v: string | undefined) => v === "true";

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const appEnv = (env.APP_ENV ?? "development") as AppEnv;
  return {
    appEnv,
    appUrl: env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    brandName: env.BRAND_NAME ?? "LURIA",
    paymentProvider: (env.PAYMENT_PROVIDER ?? "") as AppConfig["paymentProvider"],
    wompi: {
      environment: env.WOMPI_ENVIRONMENT === "production" ? "production" : "sandbox",
      publicKey: env.WOMPI_PUBLIC_KEY ?? "",
      integritySecret: env.WOMPI_INTEGRITY_SECRET ?? "",
      eventsSecret: env.WOMPI_EVENTS_SECRET ?? "",
    },
    licenseAdapter: (env.LICENSE_ADAPTER ?? "pending") as AppConfig["licenseAdapter"],
    licenseManualRevocationConfirmed: bool(env.LICENSE_MANUAL_REVOCATION_CONFIRMED),
    licenseApi: { baseUrl: env.LICENSE_API_BASE_URL ?? "", sharedSecret: env.LICENSE_API_SHARED_SECRET ?? "" },
    licenseTokenPrivateKey: env.LICENSE_TOKEN_PRIVATE_KEY ?? "",
    licenseTokenTtlHours: Number(env.LICENSE_TOKEN_TTL_HOURS ?? "24"),
    renewalMode: (env.RENEWAL_MODE ?? "") as AppConfig["renewalMode"],
    sellerIdentity: env.SELLER_IDENTITY ?? "",
    supportWhatsapp: env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
    extensionInstallUrl: env.EXTENSION_INSTALL_URL ?? "",
    activationSlaHours: env.ACTIVATION_SLA_HOURS ? Number(env.ACTIVATION_SLA_HOURS) : null,
    legalTextsApproved: bool(env.LEGAL_TEXTS_APPROVED),
    priceTaxTreatmentReviewed: bool(env.PRICE_TAX_TREATMENT_REVIEWED),
    supportedEnvironmentsVerified: bool(env.SUPPORTED_ENVIRONMENTS_VERIFIED),
    cronSecret: env.CRON_SECRET ?? "",
  };
}

export interface MissingItem {
  key: string;
  message: string;
}

/** Lista de condiciones indispensables para cobrar dinero real. */
export function realChargeBlockers(c: AppConfig): MissingItem[] {
  const m: MissingItem[] = [];
  const add = (key: string, message: string) => m.push({ key, message });
  if (c.paymentProvider === "" ) add("PAYMENT_PROVIDER", "Proveedor de pagos definitivo por elegir.");
  if (c.paymentProvider === "mock") add("PAYMENT_PROVIDER", "El proveedor simulado no puede cobrar dinero real.");
  if (c.paymentProvider === "mercadopago" || c.paymentProvider === "payu")
    add("PAYMENT_PROVIDER", "Adaptador documentado pero no implementado para este proveedor.");
  if (c.paymentProvider === "wompi") {
    if (c.wompi.environment !== "production") add("WOMPI_ENVIRONMENT", "Wompi está en sandbox.");
    if (!c.wompi.publicKey || !c.wompi.integritySecret || !c.wompi.eventsSecret)
      add("WOMPI_*", "Faltan credenciales autorizadas de Wompi.");
  }
  if (!c.sellerIdentity) add("SELLER_IDENTITY", "Identidad del vendedor pendiente.");
  if (!c.legalTextsApproved) add("LEGAL_TEXTS", "Textos legales pendientes de revisión jurídica.");
  if (!c.priceTaxTreatmentReviewed) add("PRICE_TAX_TREATMENT", "Tratamiento tributario del precio pendiente.");
  if (!c.supportedEnvironmentsVerified) add("SUPPORTED_ENVIRONMENTS", "Compatibilidad exacta por verificar.");
  if (!c.renewalMode) add("RENEWAL_MODE", "Modalidad de renovación por acordar.");
  if (c.activationSlaHours === null) add("ACTIVATION_SLA", "Plazo de activación por definir.");
  if (c.licenseAdapter === "pending") add("LICENSE_ADAPTER", "Integración de licencias pendiente.");
  if (c.licenseAdapter === "simulated") add("LICENSE_ADAPTER", "Licencias simuladas: no dan acceso real.");
  if (c.licenseAdapter === "manual" && !c.licenseManualRevocationConfirmed)
    add("LICENSE_ADAPTER", "Activación manual solo si existe un mecanismo real de vigencia y revocación.");
  if (c.licenseAdapter === "http" && (!c.licenseApi.baseUrl || !c.licenseApi.sharedSecret))
    add("LICENSE_API", "Faltan URL y secreto del servicio de licencias.");
  if (!c.extensionInstallUrl) add("EXTENSION_INSTALL_URL", "Enlace real de instalación por proporcionar.");
  return m;
}

export function realChargesEnabled(c: AppConfig): boolean {
  return c.appEnv === "production" && realChargeBlockers(c).length === 0;
}

export function simulationAllowed(c: AppConfig): boolean {
  return c.appEnv !== "production" && c.paymentProvider === "mock";
}

/** Falla al arrancar si producción contiene piezas simuladas (A20). */
export function assertSafeConfig(c: AppConfig): void {
  if (c.appEnv !== "production") return;
  const problems: string[] = [];
  if (c.paymentProvider === "mock") problems.push("PAYMENT_PROVIDER=mock no está permitido en producción");
  if (c.licenseAdapter === "simulated") problems.push("LICENSE_ADAPTER=simulated no está permitido en producción");
  if (c.wompi.environment === "sandbox" && c.paymentProvider === "wompi")
    problems.push("Wompi sandbox no está permitido en producción");
  if (!c.appUrl.startsWith("https://")) problems.push("NEXT_PUBLIC_APP_URL debe usar HTTPS en producción");
  if (problems.length) throw new Error(`Configuración insegura para producción: ${problems.join("; ")}`);
}

/** Lista para el panel administrativo (/admin/configuracion) y docs/matriz-dependencias.md. */
export function dependencyStatus(c: AppConfig): { key: string; ok: boolean; detail: string }[] {
  return [
    { key: "BRAND_NAME", ok: true, detail: c.brandName },
    { key: "BRAND_ASSETS", ok: false, detail: "Elementos gráficos definitivos por confirmar (se usa logotipo tipográfico)." },
    { key: "VERIFIED_FEATURES", ok: false, detail: "Seis módulos declarados, pendientes de validación individual." },
    { key: "SUPPORTED_ENVIRONMENTS", ok: c.supportedEnvironmentsVerified, detail: "Compatibilidad exacta." },
    { key: "SELLER_IDENTITY", ok: !!c.sellerIdentity, detail: c.sellerIdentity || "Pendiente." },
    { key: "SUPPORT_WHATSAPP", ok: !!c.supportWhatsapp, detail: c.supportWhatsapp ? "Configurado." : "Número por configurar." },
    { key: "EXTENSION_INSTALL_URL", ok: !!c.extensionInstallUrl, detail: c.extensionInstallUrl ? "Configurado." : "Enlace real por proporcionar." },
    { key: "LICENSE_ADAPTER", ok: !["pending", "simulated"].includes(c.licenseAdapter), detail: c.licenseAdapter },
    { key: "PAYMENT_PROVIDER", ok: c.paymentProvider === "wompi", detail: c.paymentProvider || "Por elegir." },
    { key: "RENEWAL_MODE", ok: !!c.renewalMode, detail: c.renewalMode || "Manual o automático por acordar." },
    { key: "PRICE_TAX_TREATMENT", ok: c.priceTaxTreatmentReviewed, detail: "Revisión tributaria." },
    { key: "LEGAL_TEXTS", ok: c.legalTextsApproved, detail: "Revisión jurídica." },
    { key: "ACTIVATION_SLA", ok: c.activationSlaHours !== null, detail: c.activationSlaHours !== null ? `${c.activationSlaHours} h` : "Por definir." },
  ];
}
