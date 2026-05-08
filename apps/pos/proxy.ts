import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  const session = request.cookies.get("pos_access_token");

  if (!isPublic && !session) {
    const loginURL = new URL("/login", request.url);
    loginURL.searchParams.set("from", pathname);
    return NextResponse.redirect(loginURL);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api).*)"],
};
