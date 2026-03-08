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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PeopleProvider>
          <Navigation />
          {children}
        </PeopleProvider>
      </body>
    </html>
  )
}
