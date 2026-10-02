import { NextResponse, type NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { getBearerUserId } from "@/lib/mobile-auth";
import { currentNeonSession } from "@/lib/session-version";

// /api/mobile routes check the iOS app's bearer token themselves
const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/api/auth", "/api/mobile"];

export const proxy = async (request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    const { updateSession } = await import("@/lib/supabase/middleware");
    return updateSession(request);
  }

  if (process.env.DATABASE_URL) {
    const { pathname } = request.nextUrl;
    const isPublicPath =
      pathname === "/" ||
      PUBLIC_PATHS.some((p) => p !== "/" && pathname.startsWith(p));

    let hasSession = false;
    const isSecure = request.nextUrl.protocol === "https:";
    const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const raw = request.cookies.get(cookieName)?.value;
    if (raw) {
      try {
        const decoded = await decode({ token: raw, secret: process.env.AUTH_SECRET!, salt: cookieName });
        hasSession = !!decoded && await currentNeonSession(decoded.id, decoded.sessionVersion);
      } catch {
        hasSession = false;
      }
    }
    // the iOS app calls the shared AI routes with a bearer token, not a cookie
    if (!hasSession) hasSession = !!(await getBearerUserId(request));

    if (!hasSession && !isPublicPath) {
      // API callers get JSON they can act on, not the login page's HTML
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    if (hasSession && (pathname === "/login" || pathname === "/signup")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next({ request });
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
