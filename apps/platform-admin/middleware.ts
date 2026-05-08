import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/internal-admin/login" ||
    pathname === "/barbera-icon.svg" ||
    pathname.startsWith("/api/"); // allow API routes without session check

  if (!isPublicRoute && !request.cookies.get("platform_session")) {
    const loginURL = new URL("/login", request.url);
    return NextResponse.redirect(loginURL);
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|barbera-icon.svg).*)"]
};
