import NextAuth, { type DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const getAuthApiCandidates = () => {
  const candidates = [
    process.env.BACKEND_INTERNAL_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://backend:8000',
    'http://localhost:8000',
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      org_id: string;
      role: string;
      accessToken: string;
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: '/auth/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          for (const baseUrl of getAuthApiCandidates()) {
            try {
              const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                body: JSON.stringify({
                  email: credentials.email,
                  password: credentials.password,
                }),
                headers: { 'Content-Type': 'application/json' },
              });

              const data = await res.json().catch(() => null);

              if (res.ok && data?.user) {
                return {
                  id: data.user.id,
                  name: data.user.name,
                  email: data.user.email,
                  org_id: data.user.org_id,
                  role: data.user.role,
                  accessToken: data.access_token,
                };
              }

              if (res.status === 400 || res.status === 401) {
                return null;
              }
            } catch {
              continue;
            }
          }

          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      if (nextUrl.pathname.startsWith('/dashboard')) {
        return !!auth?.user;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.org_id = user.org_id;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.org_id = token.org_id as string;
        session.user.role = token.role as string;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
});