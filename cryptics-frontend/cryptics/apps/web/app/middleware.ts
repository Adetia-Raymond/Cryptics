import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  const isAuthPage = req.nextUrl.pathname.startsWith("/login")
    || req.nextUrl.pathname.startsWith("/register")
    || req.nextUrl.pathname.startsWith("/forgot-password")
    || req.nextUrl.pathname.startsWith("/reset-password");

  // If NOT authenticated and trying to access PROTECTED pages → redirect to login
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If authenticated and trying to access AUTH pages → redirect to homepage
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
