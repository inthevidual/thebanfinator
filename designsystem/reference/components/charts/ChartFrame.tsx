import * as React from 'react'
import { Table2, LineChart as LineIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface SeriesDef {
  key: string
  label: string
  color: string
  /** Formaterar värdet i legend, tabell och verktygstips. */
  format: (v: number) => string
}

interface Props {
  title: string
  description?: string
  series: SeriesDef[]
  /** Raddata för tabellvyn — samma siffror som diagrammet visar. */
  tableRows?: { label: string; values: Record<string, number> }[]
  /**
   * Kolumner som bara hör hemma i tabellen. Siffror som visas i verktygstipset
   * men inte ritas som egen serie måste ändå gå att läsa utan att hovra — de
   * får plats här, utan färgprick i teckenförklaringen.
   */
  tableOnly?: SeriesDef[]
  right?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Gemensam ram runt varje diagram: rubrik, teckenförklaring och en
 * tabellvy. Tabellen är inte en extrafunktion utan tillgänglighetskravet —
 * identitet får aldrig bara bäras av färg.
 */
export function ChartFrame({ title, description, series, tableRows, tableOnly, right, className, children }: Props) {
  const columns = React.useMemo(() => [...series, ...(tableOnly ?? [])], [series, tableOnly])
  const [showTable, setShowTable] = React.useState(false)
  const canToggle = (tableRows?.length ?? 0) > 0

  return (
    <figure className={cn('rounded-lg border bg-[var(--color-surface-raised)] p-5', className)}>
      <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-head text-[15px] font-semibold leading-tight tracking-[-0.01em]">{title}</h3>
          {description && (
            <p className="mt-1 max-w-prose text-[13px] leading-snug text-[var(--color-text-secondary)]">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          {canToggle && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              title={showTable ? 'Visa diagram' : 'Visa som tabell'}
            >
              {showTable ? <LineIcon /> : <Table2 />}
              <span className="sr-only sm:not-sr-only">{showTable ? 'Diagram' : 'Tabell'}</span>
            </Button>
          )}
        </div>
      </figcaption>

      {/* Teckenförklaring finns alltid vid två eller fler serier. */}
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {showTable && tableRows ? (
        <div className="max-h-[380px] overflow-auto rounded-md border border-[var(--color-border-secondary)]">
          <table className="w-full text-sm tabular">
            <thead className="sticky top-0 bg-[var(--color-background-tertiary)]">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Period</th>
                {columns.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.label} className="border-t border-[var(--color-border-secondary)]">
                  <td className="px-3 py-1.5">{r.label}</td>
                  {columns.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">{s.format(r.values[s.key] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  )
}

/** Verktygstips med samma utseende i alla diagram. */
export function ChartTooltip({
  active, label, rows, footer,
}: {
  active?: boolean
  label?: React.ReactNode
  rows: { key: string; label: string; color: string; value: string }[]
  footer?: React.ReactNode
}) {
  if (!active) return null
  return (
    <div className="pointer-events-none min-w-[168px] rounded-md border border-[var(--color-border-primary)] bg-[var(--color-surface-raised)] px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[12px] font-semibold">{label}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4 text-[12px]">
            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="tabular font-medium">{r.value}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1.5 border-t border-[var(--color-border-secondary)] pt-1.5 text-[11px] text-[var(--color-text-secondary)]">{footer}</div>}
    </div>
  )
}
