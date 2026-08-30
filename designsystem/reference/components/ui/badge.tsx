import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)]',
        outline: 'border-[var(--color-border-primary)] text-[var(--color-text-secondary)]',
        good: 'border-transparent bg-[var(--color-good)]/12 text-[var(--color-good)]',
        warning: 'border-transparent bg-[var(--color-warning)]/14 text-[var(--color-warning)]',
        critical: 'border-transparent bg-[var(--color-critical)]/12 text-[var(--color-critical)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
