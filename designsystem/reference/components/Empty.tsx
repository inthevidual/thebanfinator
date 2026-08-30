import * as React from 'react'
import { Inbox } from 'lucide-react'

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
      <span className="text-[var(--color-text-muted)]">{icon ?? <Inbox className="h-6 w-6" />}</span>
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-[13px] text-[var(--color-text-secondary)]">{hint}</p>}
    </div>
  )
}
