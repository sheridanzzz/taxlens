import { connectorConfig, requireSameOrigin } from "@/lib/airtail-security";
import { connectorJson, connectorUser, getConnection, callAirtail, removeConnection } from "@/lib/airtail-server";

export async function GET(request: Request) {
  try {
    let configured = true;
    try { connectorConfig(); } catch { configured = false; }
    const user = await connectorUser(request);
    const connection = user ? await getConnection(user) : null;
    return connectorJson({ configured, signedIn: !!user, connected: !!connection,
      accountEmail: connection?.account_email, expiresAt: connection?.expires_at,
      expired: connection ? Date.parse(connection.expires_at) <= Date.now() : false });
  } catch (error) { return connectorJson({ error: error instanceof Error ? error.message : "Could not load the connection." }, 503); }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await connectorUser();
    if (!user) return connectorJson({ error: "Sign in to Ledgr first." }, 401);
    if (await getConnection(user)) await callAirtail(user, "receipts", "DELETE");
    await removeConnection(user);
    return connectorJson({ disconnected: true });
  } catch (error) { return connectorJson({ error: error instanceof Error ? error.message : "Could not disconnect. Try again." }, 503); }
}
