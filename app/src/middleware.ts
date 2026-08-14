import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page itself must stay reachable, or nobody could ever
  // sign in.
  if (pathname === "/staff/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/staff")) {
    const token = request.cookies.get("majlis_session")?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      const loginUrl = new URL("/staff/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/:path*"],
};
