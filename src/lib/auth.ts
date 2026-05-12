import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import {
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
} from './api/rate-limit'
import { logAction } from './api/audit'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const ip = getClientIp(req?.headers ?? {})

        // Cortar antes de consultar BD si la IP está bloqueada
        if (checkLoginRateLimit(ip)) {
          await logAction({ action: 'auth.login_rate_limited', ip })
          throw new Error('TooManyAttempts')
        }

        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        // Ejecutar bcrypt siempre, exista o no el usuario, para evitar timing
        // side-channel que permita enumerar emails registrados por tiempo de respuesta.
        const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uR6JOsJI4h3EW2yGJ5X5h9WXf9ZIlO6e'
        const valid = await bcrypt.compare(
          credentials.password,
          user?.password_hash ?? DUMMY_HASH
        )

        // Respuesta genérica — no revelar si el usuario existe o no
        if (!user || !valid) {
          recordFailedLogin(ip)
          await logAction({ action: 'auth.login_failed', ip })
          return null
        }

        clearLoginAttempts(ip)

        await prisma.user.update({
          where: { id: user.id },
          data: { last_login_at: new Date() },
        })

        await logAction({ action: 'auth.login', userId: user.id, ip })

        return { id: user.id, email: user.email, role: user.role }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/admin/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
}
