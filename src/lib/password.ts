// OWASP's floor for PBKDF2-SHA256. Web Crypto only, so this also runs on edge.
const PBKDF2_ITERATIONS = 210_000;
export const MIN_PASSWORD_LENGTH = 8;

const toHex = (buf: ArrayBuffer | Uint8Array): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? []);

/** Comparison that doesn't leak how many leading characters matched. */
const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const derive = async (
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
};

/** Stored as `pbkdf2$<iterations>$<salt>$<hash>`. */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
};

const legacySha256 = async (password: string): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)));

/**
 * Verifies against either format. Accounts created before salting still hold a
 * bare SHA-256 digest; those are re-hashed on the next successful login.
 */
export const verifyPassword = async (
  password: string,
  stored: string
): Promise<{ ok: boolean; needsUpgrade: boolean }> => {
  if (!stored.startsWith("pbkdf2$")) {
    return {
      ok: constantTimeEqual(await legacySha256(password), stored),
      needsUpgrade: true,
    };
  }
  const [, iterations, salt, hash] = stored.split("$");
  const computed = await derive(password, fromHex(salt), Number(iterations));
  return { ok: constantTimeEqual(computed, hash), needsUpgrade: false };
};
