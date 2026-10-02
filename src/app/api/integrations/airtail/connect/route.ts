import { cookies } from "next/headers";
import { connectorConfig, randomSecret, challengeFor, requireSameOrigin, seal } from "@/lib/airtail-security";
import { connectorJson, connectorUser, getConnection } from "@/lib/airtail-server";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await connectorUser();
    if (!user) return connectorJson({ error: "Sign in to a cloud Ledgr account to connect Airtail." }, 401);
    const config = connectorConfig();
    await getConnection(user); // Detect a missing migration before granting access.
    const state = randomSecret();
    const verifier = randomSecret();
    (await cookies()).set("ledgr_airtail_flow", seal(JSON.stringify({ userId: user.id, state, verifier, createdAt: Date.now() }), "flow"), {
      httpOnly: true, sameSite: "lax", secure: config.ledgr.startsWith("https:"), path: "/api/integrations/airtail", maxAge: 600,
    });
    const url = new URL(`${config.airtail}/connect/ledgr`);
    url.search = new URLSearchParams({ redirect_uri: `${config.ledgr}/api/integrations/airtail/callback`, state,
      code_challenge: challengeFor(verifier), code_challenge_method: "S256" }).toString();
    return connectorJson({ url: url.href });
  } catch (error) { return connectorJson({ error: error instanceof Error ? error.message : "Could not start the connection." }, 503); }
}
