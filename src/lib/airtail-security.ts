import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const randomSecret = () => randomBytes(32).toString("base64url");
export const challengeFor = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function appOrigin(value: string | undefined): string {
  if (!value) throw new Error("The Airtail connector is not configured.");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Configure an HTTPS app origin, or localhost for development.");
  }
  return url.origin;
}

function key() {
  const secret = process.env.AIRTAIL_CONNECTOR_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configure AIRTAIL_CONNECTOR_SECRET with at least 32 characters.");
  return createHash("sha256").update(secret).digest();
}

export function seal(value: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  return Buffer.concat([iv, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64url");
}

export function unseal(value: string, purpose: string): string {
  const data = Buffer.from(value, "base64url");
  if (data.length < 29) throw new Error("Invalid encrypted connection.");
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]).toString("utf8");
}

export function connectorConfig() {
  key();
  return { airtail: appOrigin(process.env.AIRTAIL_URL), ledgr: appOrigin(process.env.LEDGR_APP_URL) };
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Invalid request origin.");
}

export interface ConnectionFlow { userId: string; state: string; verifier: string; createdAt: number }
export function validateFlow(flow: ConnectionFlow, userId: string, state: string | null, now = Date.now()) {
  if (flow.userId !== userId || !state || flow.state !== state || now < flow.createdAt || now - flow.createdAt > 600_000) {
    throw new Error("Connection expired. Start again from Ledgr Settings.");
  }
}
