import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PeopleProvider } from './components/PeopleProvider'
import { AuthProvider } from './components/AuthProvider'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Wags and Walks',
  description: 'Wags and Walks application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <PeopleProvider>
            {children}
          </PeopleProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
