import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { isJwtSessionError } from "@/lib/auth/session-error";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "production"
    ? undefined
    : "local-development-secret-change-before-production-release");

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  session: { strategy: "jwt" },
  logger: {
    error(error) {
      if (isJwtSessionError(error)) {
        return;
      }

      console.error(error);
    },
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Demo Operator",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const expectedEmail =
          process.env.DEMO_OPERATOR_EMAIL ?? "operator@nexcore.local";
        const expectedPassword =
          process.env.DEMO_OPERATOR_PASSWORD ?? "mission-control";

        if (
          parsed.data.email !== expectedEmail ||
          parsed.data.password !== expectedPassword
        ) {
          return null;
        }

        return {
          id: "operator-demo",
          name: "Operations Operator",
          email: expectedEmail,
          role: "operations_operator",
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role ?? "operations_operator";
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "operator-demo";
        session.user.role =
          token.role === "operations_operator"
            ? token.role
            : "operations_operator";
      }

      return session;
    },
  },
});
