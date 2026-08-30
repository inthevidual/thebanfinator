import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Porträtten från svd.se är urklippta mot genomskinlig botten, så de sitter
 *  på en tonad platta i stället för att flyta fritt. */
export function HostAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <Avatar className={cn('h-10 w-10', className)}>
      {src && <AvatarImage src={src} alt="" className="object-top" />}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
