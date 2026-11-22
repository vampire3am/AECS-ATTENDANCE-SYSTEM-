import './env';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authenticateStaff } from './credentials';
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  useSecureCookies: process.env.NODE_ENV === 'production',
  providers: [
    CredentialsProvider({
      name: 'Staff account',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authenticateStaff,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.sessionVersion =
          typeof token.sessionVersion === 'number' ? token.sessionVersion : 0;
      }
      return session;
    },
  },
};
