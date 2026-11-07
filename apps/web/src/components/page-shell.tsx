import { cn } from '@/lib/utils'

/** The standard reading column. Keeps every page on one rhythm. */
export function PageShell({
  children,
  className,
  width = 'default',
}: {
  children: React.ReactNode
  className?: string
  width?: 'default' | 'wide'
}) {
  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          'mx-auto w-full px-6 py-10 animate-fade-in',
          width === 'wide' ? 'max-w-6xl' : 'max-w-4xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
