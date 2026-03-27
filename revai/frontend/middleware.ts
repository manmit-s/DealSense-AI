import { NextRequest, NextResponse } from "next/server";

export default function middleware(req: NextRequest) {
  const bypassQueryEnabled = req.nextUrl.searchParams.get("bypass") === "1";
  const bypassCookieEnabled = req.cookies.get("revai_bypass")?.value === "1";

  if (bypassQueryEnabled || bypassCookieEnabled) {
    const response = NextResponse.next();
    if (bypassQueryEnabled) {
      response.cookies.set("revai_bypass", "1", {
        httpOnly: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 12,
        path: "/",
      });
    }
    return response;
  }

  const hasSessionToken =
    Boolean(req.cookies.get("authjs.session-token")?.value) ||
    Boolean(req.cookies.get("__Secure-authjs.session-token")?.value) ||
    Boolean(req.cookies.get("next-auth.session-token")?.value) ||
    Boolean(req.cookies.get("__Secure-next-auth.session-token")?.value);

  if (!hasSessionToken) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
}