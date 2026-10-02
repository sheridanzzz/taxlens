import { createHash, createHmac, randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { hashPassword, MIN_PASSWORD_LENGTH } from "./password";

export const RESET_MESSAGE = "If an account matches that email, we’ll send a password reset link. Check your inbox and spam folder.";
export const RESET_TTL_SECONDS = 30 * 60;
export const resetTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const validResetToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export const validResetPassword = (value: unknown): value is string => typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH && value.length <= 256;
export function recoveryEmail(value: unknown): string {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new Error("Enter a valid email address.");
  return value.trim().toLowerCase();
}

export function recoveryOrigin() {
  const value = process.env.LEDGR_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("Recovery app URL is not configured.");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("Recovery app URL is invalid.");
  return url.origin;
}

export function recoverySender() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_EMAIL_FROM;
  if (!apiKey || !from || /[\r\n]/.test(from)) throw new Error("Password reset email is not configured yet. Please try again later.");
  return { apiKey, from };
}

export async function sendRecoveryEmail(email: string, token: string) {
  const { apiKey, from } = recoverySender();
  // The fragment never reaches request logs or the HTTP Referer header.
  const link = `${recoveryOrigin()}/reset-password#token=${token}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Reset your Ledgr password",
      text: `You requested a password reset for Ledgr.\n\nChoose a new password: ${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.`, }),
    signal: AbortSignal.timeout(10_000), redirect: "error",
  });
  if (!response.ok) throw new Error("Password reset email could not be sent.");
}

export function recoveryKey(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Recovery signing secret is not configured.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Atomic counters work across serverless instances; expired buckets are pruned. */
export async function takeRecoveryLimit(db: NeonQueryFunction<false, false>, key: string, limit: number, seconds: number) {
  const rows = await db.query(`INSERT INTO password_reset_limits(key_hash,window_start,attempts) VALUES($1,now(),1)
    ON CONFLICT(key_hash) DO UPDATE SET
      window_start=CASE WHEN password_reset_limits.window_start <= now()-($3*interval '1 second') THEN now() ELSE password_reset_limits.window_start END,
      attempts=CASE WHEN password_reset_limits.window_start <= now()-($3*interval '1 second') THEN 1 ELSE password_reset_limits.attempts+1 END
    WHERE password_reset_limits.window_start <= now()-($3*interval '1 second') OR password_reset_limits.attempts < $2 RETURNING attempts`, [key, limit, seconds]);
  return rows.length === 1;
}

/** Known and unknown accounts have the same HTTP response. No token is returned. */
export async function requestRecovery(db: NeonQueryFunction<false, false>, email: string, ip: string, deliver = sendRecoveryEmail) {
  if (!(await takeRecoveryLimit(db, recoveryKey(`request-ip:${ip}`), 20, 900))) return;
  if (!(await takeRecoveryLimit(db, recoveryKey(`request-email:${email}`), 3, 3600))) return;
  await db.query("DELETE FROM password_reset_tokens WHERE expires_at<=now()");
  await db.query("DELETE FROM password_reset_limits WHERE window_start<now()-interval '1 day'");
  const users = await db.query("SELECT id,email FROM users WHERE lower(email)=$1", [email]);
  if (users.length !== 1) return;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = resetTokenHash(token);
  await db.query("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+($3*interval '1 second'))", [tokenHash, users[0].id, RESET_TTL_SECONDS]);
  try { await deliver(String(users[0].email), token); }
  catch { await db.query("DELETE FROM password_reset_tokens WHERE token_hash=$1", [tokenHash]); }
}

/** Row lock + one statement makes token use, password update and revocation atomic. */
export async function completeRecovery(db: NeonQueryFunction<false, false>, token: string, password: string) {
  if (!validResetToken(token) || !validResetPassword(password)) return false;
  const passwordHash = await hashPassword(password);
  const rows = await db.query(`WITH locked AS (
      SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id=u.id
      WHERE t.token_hash=$1 FOR UPDATE OF u
    ), consumed AS (
      DELETE FROM password_reset_tokens t USING locked l WHERE t.token_hash=$1 AND t.user_id=l.id AND t.expires_at>now() RETURNING t.user_id
    ), updated AS (
      UPDATE users u SET password_hash=$2,session_version=session_version+1 FROM consumed c WHERE u.id=c.user_id RETURNING u.id
    ), remaining AS (
      DELETE FROM password_reset_tokens t USING updated u WHERE t.user_id=u.id AND t.token_hash<>$1 RETURNING t.token_hash
    ) SELECT id FROM updated`, [resetTokenHash(token), passwordHash]);
  return rows.length === 1;
}

export async function recoveryBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Invalid request origin.");
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) throw new Error("Expected JSON.");
  if (Number(request.headers.get("content-length") || 0) > 2048) throw new Error("Request too large.");
  if (!request.body) throw new Error("Invalid request.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2048) { await reader.cancel(); throw new Error("Request too large."); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request.");
  return body;
}
export const recoveryJson = (body: unknown, status=200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
export const recoveryIp = (request: Request) => (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0,128);
