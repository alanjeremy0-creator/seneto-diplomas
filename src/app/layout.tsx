import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SessionProviderWrapper } from '@/components/providers/SessionProviderWrapper'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Seneto — Diplomas Digitales',
  description: 'Sistema de generación y verificación de diplomas digitales.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} antialiased`}>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  )
}
