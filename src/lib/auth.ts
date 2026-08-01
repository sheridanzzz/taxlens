import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { sql, isNeonConfigured } from "@/lib/neon";
import {
  hashPassword,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/password";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        action: { label: "Action", type: "text" },
      },
      async authorize(credentials) {
        if (!isNeonConfigured()) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;
        const action = credentials.action as string | undefined;

        if (!email || !password) return null;

        const db = sql();

        if (action === "signup") {
          if (password.length < MIN_PASSWORD_LENGTH) return null;
          const existing = await db`SELECT id FROM users WHERE email = ${email}`;
          if (existing.length > 0) return null;

          const result = await db`INSERT INTO users (email, password_hash) VALUES (${email}, ${await hashPassword(password)}) RETURNING id, email`;
          if (!result[0]) return null;
          return { id: result[0].id as string, email: result[0].email as string };
        }

        const rows = await db`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
        if (!rows[0]) return null;

        const { ok, needsUpgrade } = await verifyPassword(
          password,
          rows[0].password_hash as string
        );
        if (!ok) return null;

        if (needsUpgrade) {
          await db`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${rows[0].id as string}`;
        }

        return { id: rows[0].id as string, email: rows[0].email as string };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
