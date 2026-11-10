/**
 * Genera prototype/dist/index.html a partir de la plantilla, inyectando los MISMOS
 * contenidos y estilos que usa la aplicación (fuente única: src/lib/content y src/app/globals.css).
 * Uso: npm run prototype:build
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURES, FEATURE_STATUS_LABEL } from "../src/lib/content/features";
import { FAQS } from "../src/lib/content/faqs";
import { LEGAL_DOCS } from "../src/lib/content/legal";
import { DESKTOP_REQUIREMENT, INDEPENDENCE_NOTICE } from "../src/lib/content/site";
import { dependencyStatus, loadConfig } from "../src/lib/config";

const root = join(__dirname, "..");
const data = {
  features: FEATURES,
  statusLabels: FEATURE_STATUS_LABEL,
  faqs: FAQS,
  legal: LEGAL_DOCS,
  desktop: DESKTOP_REQUIREMENT,
  independence: INDEPENDENCE_NOTICE,
  deps: dependencyStatus(loadConfig({ APP_ENV: "development", PAYMENT_PROVIDER: "mock", LICENSE_ADAPTER: "pending" })).map((d) => [d.key, d.ok, d.detail]),
};
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
const html = readFileSync(join(root, "prototype/template.html"), "utf8")
  .replace("/*__CSS__*/", () => css)
  .replace("/*__DATA__*/", () => JSON.stringify(data).replace(/</g, "\\u003c"));
mkdirSync(join(root, "prototype/dist"), { recursive: true });
writeFileSync(join(root, "prototype/dist/index.html"), html);
console.log(`prototype/dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
