import { cn } from '@/lib/utils'

/** Loading shape. Mirror the real content's size so nothing jumps on load. */
export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
)
