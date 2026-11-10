/**
 * Genera un par de llaves Ed25519 para la opción B (tokens de licencia).
 * La privada va a LICENSE_TOKEN_PRIVATE_KEY (solo servidor); la pública se incrusta en la extensión.
 * Uso: npm run keys:license
 */
import { generateKeyPairSync } from "node:crypto";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
console.log("# PRIVADA (secreto del servidor):\n" + privateKey.export({ type: "pkcs8", format: "pem" }));
console.log("# PÚBLICA (para la extensión):\n" + publicKey.export({ type: "spki", format: "pem" }));
