import { sql, isNeonConfigured } from "@/lib/neon";
import { completeRecovery, recoveryBody, recoveryIp, recoveryJson, recoveryKey, takeRecoveryLimit, validResetPassword, validResetToken } from "@/lib/password-recovery";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await recoveryBody(request); }
  catch { return recoveryJson({ error: "Invalid reset request. Please try again." }, 400); }
  if (!validResetToken(body.token)) return recoveryJson({ error: "This reset link is invalid or expired. Request a new one." }, 400);
  if (!validResetPassword(body.password)) return recoveryJson({ error: "Use a password between 8 and 256 characters." }, 400);
  if (!isNeonConfigured()) return recoveryJson({ error: "Password recovery is unavailable for this backend." }, 503);
  try {
    const db = sql();
    if (!(await takeRecoveryLimit(db, recoveryKey(`reset-ip:${recoveryIp(request)}`), 30, 900))) return recoveryJson({ error: "Too many attempts. Please try again later." }, 429);
    if (!(await completeRecovery(db, body.token, body.password))) return recoveryJson({ error: "This reset link is invalid or expired. Request a new one." }, 400);
    return recoveryJson({ message: "Password updated. Sign in with your new password." });
  } catch { return recoveryJson({ error: "Could not update your password. Please try again." }, 503); }
}
