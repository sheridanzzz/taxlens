import { NextResponse } from "next/server";
import { authorizeCredentials } from "@/lib/auth";
import { issueMobileToken } from "@/lib/mobile-auth";

// iOS app sign-in / sign-up: same credential check as the web, but the answer
// is a bearer token instead of a session cookie.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const user = body && (await authorizeCredentials({
    email: typeof body.email === "string" ? body.email.trim() : undefined,
    password: body.password,
    action: body.action === "signup" ? "signup" : undefined,
  }));
  if (!user) {
    return NextResponse.json(
      {
        error:
          body?.action === "signup"
            ? "Couldn't create that account. The email may already be in use, or the password is under 8 characters."
            : "Wrong email or password.",
      },
      { status: 401 }
    );
  }
  return NextResponse.json({ token: await issueMobileToken(user), user });
}
