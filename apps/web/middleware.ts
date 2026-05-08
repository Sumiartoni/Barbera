import { NextRequest, NextResponse } from "next/server";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

const publicPrefixes = ["/", "/login", "/q/", "/api/public/"];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  const isPublicRoute = publicPrefixes.some((prefix) =>
    prefix === "/"
      ? request.nextUrl.pathname === "/"
      : request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(prefix),
  );

  if (!isPublicRoute && !request.cookies.get("tenant_session")) {
    const loginURL = new URL("/login", request.url);
    loginURL.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginURL);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
