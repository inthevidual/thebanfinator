import * as React from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/misc'

/** Det useAsync lämnar ifrån sig, sett från panelen som väntar på svaret. */
export interface Load {
  loading: boolean
  error: Error | null
  reload: () => void
}

/** Slår ihop flera hämtningar till ett tillstånd, för paneler som behöver alla. */
export function merge(...loads: Load[]): Load {
  return {
    loading: loads.some((l) => l.loading),
    error: loads.find((l) => l.error)?.error ?? null,
    reload: () => loads.forEach((l) => l.reload()),
  }
}

/**
 * Vad panelen ska visa i stället för sitt innehåll: skelettet medan svaret är
 * på väg, en förklaring om det uteblev, annars null.
 *
 * Poängen är att ett misslyckat anrop aldrig ska nå fram till diagrammen. De
 * läser `data ?? []` och ritar ut ett uteblivet svar som nollor — vilket ser ut
 * som en period utan poster, inte som ett fel. Felrutan får samma mått som
 * skelettet, så att sidan inte hoppar när svaret kommer eller uteblir.
 */
export function gate(load: Load, size: string, skeleton?: React.ReactNode): React.ReactNode | null {
  const fallback = skeleton ?? <Skeleton className={size} />
  // 401 hör till inloggningen, inte hit: sessionen är slut och routern är
  // redan på väg till inloggningssidan. Låt skelettet stå kvar så länge.
  if (load.error instanceof ApiError && load.error.status === 401) return fallback
  if (load.error) return <LoadError error={load.error} onRetry={load.reload} className={size} />
  if (load.loading) return fallback
  return null
}

export function LoadError({ error, onRetry, className }: {
  error: Error
  onRetry: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center',
        className
      )}
    >
      {/* Ikonen bär larmet, inte hela rutan. Slår hela sidan fel står de här
          bredvid varandra, och sju röda fält skriker mer än de förklarar. */}
      <AlertCircle className="h-5 w-5 shrink-0 text-[var(--color-critical)]" aria-hidden />
      <p className="font-medium">Siffrorna kunde inte hämtas</p>
      <p className="max-w-sm text-[13px] leading-snug text-[var(--color-text-secondary)]">{error.message}</p>
      <button
        onClick={onRetry}
        className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-action)]
                   underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-[var(--color-focus)] focus-visible:rounded"
      >
        <RotateCw className="h-3.5 w-3.5" aria-hidden />
        Försök igen
      </button>
    </div>
  )
}
