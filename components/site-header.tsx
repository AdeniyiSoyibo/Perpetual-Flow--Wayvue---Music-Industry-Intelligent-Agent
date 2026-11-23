'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/farmer" className="font-semibold text-lg tracking-tight">
          Harvest IQ
        </Link>
        <nav className="flex gap-1 ml-auto">
          <Link
            href="/farmer"
            className={cn(
              'rounded px-3 py-1.5 text-sm transition-colors hover:bg-muted',
              pathname === '/farmer' ? 'bg-muted font-medium' : 'text-muted-foreground',
            )}
          >
            Ask a Question
          </Link>
        </nav>
      </div>
    </header>
  )
}
