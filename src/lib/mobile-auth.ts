import { encode, decode } from "next-auth/jwt";

// The iOS app can't hold the web's session cookie, so it signs in once for a
// bearer token: the same Auth.js encrypted JWT, under its own salt so a token
// can never be replayed as a web session cookie or vice versa.
const SALT = "ledgr-mobile";
// ponytail: long-lived, no refresh or revocation list. Changing AUTH_SECRET
// signs every device out; add a tokens table if per-device revoke is needed.
const MAX_AGE = 60 * 60 * 24 * 90;

export const issueMobileToken = (user: { id: string; email: string }) =>
  encode({
    token: { sub: user.id, email: user.email },
    secret: process.env.AUTH_SECRET!,
    salt: SALT,
    maxAge: MAX_AGE,
  });

/** User id from an `Authorization: Bearer` header, or null if absent/invalid/expired. */
export const getBearerUserId = async (request: Request): Promise<string | null> => {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const token = await decode({
      token: header.slice(7),
      secret: process.env.AUTH_SECRET!,
      salt: SALT,
    });
    return typeof token?.sub === "string" ? token.sub : null;
  } catch {
    return null;
  }
};
