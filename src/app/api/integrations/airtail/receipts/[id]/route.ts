import { connectorJson, connectorUser, callAirtail } from "@/lib/airtail-server";

export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await connectorUser();
    if (!user) return connectorJson({ error: "Sign in to Ledgr first." }, 401);
    const { id } = await params;
    if (!/^[a-f0-9]{24}$/.test(id)) return connectorJson({ error: "Receipt not found." }, 404);
    return connectorJson(await callAirtail(user, `receipts/${id}`));
  } catch (error) { return connectorJson({ error: error instanceof Error ? error.message : "Could not retrieve this receipt." }, 503); }
}
