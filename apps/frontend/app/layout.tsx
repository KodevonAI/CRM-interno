import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: {
    template: '%s | KodevonCRM',
    default: 'KodevonCRM',
  },
  description: 'CRM inteligente para Kodevon — software, IA y automatizaciones',
}

export const viewport: Viewport = {
  themeColor: '#0F1117',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
