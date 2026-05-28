import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "operations_operator";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "operations_operator";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "operations_operator";
  }
}
