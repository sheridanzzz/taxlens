import { cookies } from "next/headers";
import { connectorConfig, unseal, validateFlow, type ConnectionFlow } from "@/lib/airtail-security";
import { connectorUser, getConnection, saveConnection } from "@/lib/airtail-server";

export async function GET(request: Request) {
  const store = await cookies();
  const encrypted = store.get("ledgr_airtail_flow")?.value;
  store.set("ledgr_airtail_flow", "", { path: "/api/integrations/airtail", maxAge: 0 });
  let outcome = "failed";
  try {
    const config = connectorConfig();
    const user = await connectorUser();
    if (!user || !encrypted) throw new Error("Missing connection session.");
    const params = new URL(request.url).searchParams;
    const flow = JSON.parse(unseal(encrypted, "flow")) as ConnectionFlow;
    validateFlow(flow, user.id, params.get("state"));
    if (params.get("error") === "access_denied") outcome = "cancelled";
    else {
      const code = params.get("code");
      if (!code || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new Error("Missing authorization code.");
      const result = await fetch(`${config.airtail}/api/integrations/ledgr/token`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, code_verifier: flow.verifier, redirect_uri: `${config.ledgr}/api/integrations/airtail/callback` }),
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
      const data = await result.json();
      if (!result.ok || !/^airtail_[A-Za-z0-9_-]{43}$/.test(data.accessToken || "") || typeof data.accountEmail !== "string" ||
        !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) throw new Error("Invalid token response.");
      const previous = await getConnection(user);
      try { await saveConnection(user, data.accessToken, data.accountEmail, data.expiresAt); }
      catch (error) {
        await fetch(`${config.airtail}/api/integrations/ledgr/receipts`, { method: "DELETE", headers: { Authorization: `Bearer ${data.accessToken}` }, signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
        throw error;
      }
      if (previous) await fetch(`${config.airtail}/api/integrations/ledgr/receipts`, { method: "DELETE",
        headers: { Authorization: `Bearer ${unseal(previous.token_ciphertext, `token:${user.id}`)}` }, signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
      outcome = "connected";
    }
  } catch { /* Never echo codes, secrets, or upstream response bodies. */ }
  const origin = process.env.LEDGR_APP_URL ? new URL(process.env.LEDGR_APP_URL).origin : new URL(request.url).origin;
  return new Response(null, { status: 303, headers: { Location: `${origin}/settings?airtail=${outcome}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
