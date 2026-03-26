import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { TelegramAuthGate } from '@/components/auth/telegram-auth-gate'
import { TelegramAuthProvider } from '@/components/auth/telegram-auth-provider'
import { withAppBasePath } from '@/lib/env'
import './globals.css'

export const metadata: Metadata = {
  title: 'ODROB - Autonomous Trading Agents',
  description: 'Platform for autonomous trading agents with strategies and index products',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: withAppBasePath('/icon-light-32x32.png'),
        media: '(prefers-color-scheme: light)',
      },
      {
        url: withAppBasePath('/icon-dark-32x32.png'),
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: withAppBasePath('/icon.svg'),
        type: 'image/svg+xml',
      },
    ],
    apple: withAppBasePath('/apple-icon.png'),
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1f2e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js?61" strategy="beforeInteractive" />
        <TelegramAuthProvider>
          <TelegramAuthGate>{children}</TelegramAuthGate>
        </TelegramAuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
