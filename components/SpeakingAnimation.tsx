import { cn } from '@/lib/utils'

interface SpeakingAnimationProps {
  className?: string
}

export default function SpeakingAnimation({ className }: SpeakingAnimationProps) {
  return (
    <span
      className={cn('inline-flex items-end gap-0.5 h-5', className)}
      aria-hidden
    >
      <span className="w-1 bg-primary-foreground/80 animate-eq1 rounded-sm" />
      <span className="w-1 bg-primary-foreground/80 animate-eq2 rounded-sm" />
      <span className="w-1 bg-primary-foreground/80 animate-eq3 rounded-sm" />
    </span>
  )
}
