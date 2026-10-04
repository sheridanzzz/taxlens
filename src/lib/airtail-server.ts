import { auth } from "./auth";
import { sql } from "./neon";
import { isSupabaseConfigured, isNeonConfigured } from "./env";
import { createClient } from "./supabase/server";
import { connectorConfig, seal, unseal } from "./airtail-security";
import { getBearerUserId } from "./mobile-auth";

export type ConnectorUser = { id: string; supabase?: Awaited<ReturnType<typeof createClient>> };
export type AirtailConnection = { token_ciphertext: string; account_email: string; expires_at: string };

export async function connectorUser(request?: Request): Promise<ConnectorUser | null> {
  // The iOS app sends its bearer token instead of the web session cookie. Its
  // accounts live in Neon, like the rest of the mobile API.
  if (request?.headers.has("authorization")) {
    const id = await getBearerUserId(request);
    return id ? { id } : null;
  }
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    return error || !data.user ? null : { id: data.user.id, supabase };
  }
  if (!isNeonConfigured()) return null;
  const session = await auth();
  return session?.user?.id ? { id: session.user.id } : null;
}

export async function getConnection(user: ConnectorUser): Promise<AirtailConnection | null> {
  if (user.supabase) {
    const { data, error } = await user.supabase.from("airtail_connections").select("token_ciphertext,account_email,expires_at").eq("user_id", user.id).maybeSingle();
    if (error) throw new Error("Connection storage unavailable. Apply migration 006, then try again.");
    return data;
  }
  try {
    const rows = await sql()`SELECT token_ciphertext,account_email,expires_at FROM airtail_connections WHERE user_id=${user.id}`;
    return rows[0] ? { token_ciphertext: String(rows[0].token_ciphertext), account_email: String(rows[0].account_email), expires_at: new Date(rows[0].expires_at as string).toISOString() } : null;
  } catch { throw new Error("Connection storage unavailable. Apply migration 006, then try again."); }
}

export async function saveConnection(user: ConnectorUser, token: string, email: string, expiresAt: string) {
  const encrypted = seal(token, `token:${user.id}`);
  if (user.supabase) {
    const { error } = await user.supabase.from("airtail_connections").upsert({ user_id: user.id, token_ciphertext: encrypted, account_email: email, expires_at: expiresAt, updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not save the connection. Apply migration 006 and try again.");
  } else await sql()`INSERT INTO airtail_connections(user_id,token_ciphertext,account_email,expires_at)
    VALUES(${user.id},${encrypted},${email},${expiresAt}) ON CONFLICT(user_id) DO UPDATE SET
    token_ciphertext=excluded.token_ciphertext,account_email=excluded.account_email,expires_at=excluded.expires_at,updated_at=now()`;
}

export async function removeConnection(user: ConnectorUser) {
  if (user.supabase) {
    const { error } = await user.supabase.from("airtail_connections").delete().eq("user_id", user.id);
    if (error) throw new Error("Could not remove the connection. Try again.");
  } else await sql()`DELETE FROM airtail_connections WHERE user_id=${user.id}`;
}

export async function callAirtail(user: ConnectorUser, path: string, method = "GET", timeoutMs = 55_000) {
  const connection = await getConnection(user);
  if (!connection) throw new Error("Connect Airtail in Ledgr Settings first.");
  const response = await fetch(`${connectorConfig().airtail}/api/integrations/ledgr/${path}`, {
    method, headers: { Authorization: `Bearer ${unseal(connection.token_ciphertext, `token:${user.id}`)}` },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json().catch(() => ({ error: "Airtail returned an unexpected response." }));
  if (!response.ok && !(method === "DELETE" && response.status === 401)) throw new Error(body.error || "Could not reach Airtail. Try again.");
  return body;
}

export const connectorJson = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
