import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/generated/prisma/client";

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const role = auth?.user?.role as string | undefined;

      // Allow public routes
      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/agent") ||
        pathname.startsWith("/api/debug") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico"
      ) {
        return true;
      }

      // Redirect unauthenticated users to login
      if (!isLoggedIn) {
        return false;
      }

      // CLIENT users cannot access dashboard routes
      if (role === "CLIENT" && (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/jobs") ||
        pathname.startsWith("/templates") ||
        pathname.startsWith("/organizations") ||
        pathname.startsWith("/agents") ||
        pathname.startsWith("/approvals")
      )) {
        return Response.redirect(new URL("/portal", nextUrl));
      }

      // ADMIN/OPERATOR cannot access portal routes
      if (role !== "CLIENT" && pathname.startsWith("/portal")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
};
