import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

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

    const session = await auth();

    if (!session?.user && !isPublicPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }

    if (session?.user && (pathname === "/login" || pathname === "/signup")) {
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
