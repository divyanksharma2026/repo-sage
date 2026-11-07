import * as React from 'react'
import { cn } from '@/lib/utils'

type DivProps = React.HTMLAttributes<HTMLDivElement>

export const Card = React.forwardRef<HTMLDivElement, DivProps & { interactive?: boolean }>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground',
        interactive &&
          'transition-colors hover:border-primary/40 hover:bg-accent/40 focus-within:border-primary/40',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = ({ className, ...props }: DivProps) => (
  <div className={cn('flex flex-col gap-1 p-5', className)} {...props} />
)

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-sm font-semibold leading-none tracking-tight', className)} {...props} />
)

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
)

export const CardContent = ({ className, ...props }: DivProps) => (
  <div className={cn('p-5 pt-0', className)} {...props} />
)

export const CardFooter = ({ className, ...props }: DivProps) => (
  <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />
)
