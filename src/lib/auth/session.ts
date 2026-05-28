import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isJwtSessionError } from "@/lib/auth/session-error";

export const SESSION_TOKEN_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

export const AUTH_COOKIE_PREFIXES = [
  ...SESSION_TOKEN_COOKIE_PREFIXES,
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "authjs.pkce.code_verifier",
  "__Secure-authjs.pkce.code_verifier",
  "authjs.state",
  "__Secure-authjs.state",
  "authjs.nonce",
  "__Secure-authjs.nonce",
] as const;

export type SafeSessionResult = {
  session: Session | null;
  hasInvalidSessionToken: boolean;
};

export function isAuthCookieName(name: string) {
  return AUTH_COOKIE_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(`${prefix}.`),
  );
}

export function isSessionTokenCookieName(name: string) {
  return SESSION_TOKEN_COOKIE_PREFIXES.some(
    (prefix) => name === prefix || name.startsWith(`${prefix}.`),
  );
}

function looksLikeCompactJwe(value: string) {
  return value.split(".").length === 5;
}

async function getSessionCookieState() {
  const cookieStore = await cookies();
  const sessionCookies = cookieStore
    .getAll()
    .filter((cookie) => isSessionTokenCookieName(cookie.name));

  return {
    hasSessionCookie: sessionCookies.length > 0,
    hasMalformedSessionCookie: sessionCookies.some(
      (cookie) =>
        cookie.value &&
        SESSION_TOKEN_COOKIE_PREFIXES.some((prefix) => cookie.name === prefix) &&
        !looksLikeCompactJwe(cookie.value),
    ),
  };
}

export async function getSafeSession(): Promise<SafeSessionResult> {
  const sessionCookieState = await getSessionCookieState();

  if (sessionCookieState.hasMalformedSessionCookie) {
    return {
      session: null,
      hasInvalidSessionToken: true,
    };
  }

  try {
    const session = await auth();

    return {
      session,
      hasInvalidSessionToken:
        sessionCookieState.hasSessionCookie && !session?.user,
    };
  } catch (error) {
    if (isJwtSessionError(error)) {
      return {
        session: null,
        hasInvalidSessionToken: true,
      };
    }

    throw error;
  }
}

export function resetSessionUrl(callbackUrl = "/sign-in") {
  return `/api/auth/reset-session?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
