import { auth } from "@/app/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_CONTA_PATHS = [
  "/conta/login",
  "/conta/registro",
  "/conta/verificar-email",
  "/conta/esqueci-senha",
  "/conta/redefinir-senha",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect /conta/* except public auth pages.
  if (
    pathname.startsWith("/conta") &&
    !PUBLIC_CONTA_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    if (!req.auth) {
      const url = new URL("/conta/login", req.nextUrl.origin);
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/conta/:path*"],
};

// NOTE: `NextRequest` re-export kept for downstream callers that may extend this proxy.
export type { NextRequest };
