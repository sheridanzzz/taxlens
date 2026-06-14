import { NextResponse, type NextRequest } from "next/server";
import { decode } from "next-auth/jwt";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback", "/api/auth"];

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
        hasSession = !!decoded;
      } catch {
        hasSession = false;
      }
    }

    if (!hasSession && !isPublicPath) {
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
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
