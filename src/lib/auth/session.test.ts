import { describe, expect, it } from "vitest";
import { isJwtSessionError } from "@/lib/auth/session-error";

describe("isJwtSessionError", () => {
  it("detects a direct Auth.js JWT session error", () => {
    const error = new Error("no matching decryption secret");
    error.name = "JWTSessionError";

    expect(isJwtSessionError(error)).toBe(true);
  });

  it("detects Auth.js errors by type metadata", () => {
    expect(
      isJwtSessionError({
        type: "JWTSessionError",
        message: "Read more at https://errors.authjs.dev#jwtsessionerror",
      }),
    ).toBe(true);
  });

  it("detects nested jose decrypt errors inside an Auth.js cause", () => {
    expect(
      isJwtSessionError({
        name: "AuthError",
        cause: {
          err: new Error("no matching decryption secret"),
        },
      }),
    ).toBe(true);
  });

  it("ignores unrelated auth errors", () => {
    expect(isJwtSessionError(new Error("Invalid credentials"))).toBe(false);
  });
});
