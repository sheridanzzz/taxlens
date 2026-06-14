import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { sql, isNeonConfigured } from "@/lib/neon";

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const { handlers, signIn, signOut, auth } = NextAuth({
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
        const passwordHash = await hashPassword(password);

        if (action === "signup") {
          const existing = await db`SELECT id FROM users WHERE email = ${email}`;
          if (existing.length > 0) return null;

          const result = await db`INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash}) RETURNING id, email`;
          if (!result[0]) return null;
          return { id: result[0].id as string, email: result[0].email as string };
        }

        const rows = await db`SELECT id, email FROM users WHERE email = ${email} AND password_hash = ${passwordHash}`;
        if (!rows[0]) return null;
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
