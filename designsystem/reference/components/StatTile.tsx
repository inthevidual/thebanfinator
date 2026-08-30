import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { num } from '@/lib/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/misc'

interface Props {
  label: string
  value: string
  hint?: string
  /** Förändring i procent mot föregående lika långa period. */
  change?: number | null
  /** Är en ökning bra, dålig eller varken eller? Styr färgen på pilen. */
  direction?: 'up-good' | 'up-bad' | 'neutral'
  icon?: React.ReactNode
  className?: string
  /** Gör hela plattan klickbar — hellre en stor träffyta än en länk i en siffra. */
  onClick?: () => void
  title?: string
}

/**
 * Ett nyckeltal. Talet självt bär vikten; etikett och förändring är underordnade.
 */
export function StatTile({ label, value, hint, change, direction = 'neutral', icon, className, onClick, title }: Props) {
  const has = change !== null && change !== undefined && Number.isFinite(change)
  const up = has && (change as number) > 0.05
  const down = has && (change as number) < -0.05
  const tone =
    direction === 'neutral' || (!up && !down) ? 'text-[var(--color-text-secondary)]'
      : (up && direction === 'up-good') || (down && direction === 'up-bad') ? 'text-[var(--color-good)]'
      : 'text-[var(--color-critical)]'

  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-lg border bg-[var(--color-surface-raised)] p-4',
        onClick && 'w-full text-left transition-colors hover:bg-[var(--color-background-tertiary)]/70 '
          + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium leading-tight text-[var(--color-text-secondary)]">{label}</p>
        {icon && <span className="shrink-0 text-[var(--color-text-muted)]">{icon}</span>}
      </div>
      <p className="tabular mt-2 font-head text-[26px] font-semibold leading-none tracking-[-0.02em]">{value}</p>
      <div className="mt-2 flex min-h-[16px] items-center gap-1.5 text-[11px]">
        {has && (
          <Tooltip delayDuration={120}>
            <TooltipTrigger asChild>
              <span className={cn('inline-flex items-center gap-0.5 font-medium', tone)}>
                {up ? <ArrowUpRight className="h-3 w-3" /> : down ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {num(Math.abs(change as number), 1)} %
              </span>
            </TooltipTrigger>
            <TooltipContent>Mot föregående lika långa period</TooltipContent>
          </Tooltip>
        )}
        {hint && <span className="truncate text-[var(--color-text-muted)]">{hint}</span>}
      </div>
    </Tag>
  )
}
