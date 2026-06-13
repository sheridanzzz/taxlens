import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const proxy = async (request: NextRequest) => {
  return updateSession(request);
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
