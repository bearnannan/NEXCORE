import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_PREFIXES, isAuthCookieName } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function getSafeCallbackUrl(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");

  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/sign-in";
  }

  return callbackUrl;
}

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(getSafeCallbackUrl(request), request.url),
  );
  const cookieNames = new Set([
    ...AUTH_COOKIE_PREFIXES,
    ...request.cookies
      .getAll()
      .map((cookie) => cookie.name)
      .filter(isAuthCookieName),
  ]);

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: name.startsWith("__"),
    });
  }

  return response;
}

