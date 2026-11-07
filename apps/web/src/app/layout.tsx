import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'RepoSage — Understand any codebase',
  description:
    'Paste a GitHub repo and get an architecture overview, module breakdowns, a dependency graph, and answers that cite exact lines.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  )
}
