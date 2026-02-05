import type { Metadata } from 'next'
import './globals.css'
import Navigation from './components/Navigation'
import { PeopleProvider } from './components/PeopleProvider'

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
      <body>
        <PeopleProvider>
          <Navigation />
          {children}
        </PeopleProvider>
      </body>
    </html>
  )
}
