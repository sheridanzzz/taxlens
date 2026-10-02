import { sql, isNeonConfigured } from "@/lib/neon";
import { after } from "next/server";
import { recoveryBody, recoveryEmail, recoveryIp, recoveryJson, recoveryOrigin, recoverySender, requestRecovery, RESET_MESSAGE } from "@/lib/password-recovery";

export async function POST(request: Request) {
  let email: string;
  try { email = recoveryEmail((await recoveryBody(request)).email); }
  catch { return recoveryJson({ error: "Enter a valid email address and try again." }, 400); }
  if (!isNeonConfigured()) return recoveryJson({ error: "Password recovery is unavailable for this backend." }, 503);
  try { recoverySender(); recoveryOrigin(); }
  catch { return recoveryJson({ error: "Password reset email is not configured yet. Please try again later." }, 503); }
  try {
    const ip = recoveryIp(request);
    // Respond before account lookup or email delivery, preventing timing-based enumeration.
    after(async () => { try { await requestRecovery(sql(), email, ip); } catch { console.error("Ledgr password recovery could not complete."); } });
    return recoveryJson({ message: RESET_MESSAGE });
  }
  catch { return recoveryJson({ error: "Password recovery is temporarily unavailable. Please try again." }, 503); }
}
