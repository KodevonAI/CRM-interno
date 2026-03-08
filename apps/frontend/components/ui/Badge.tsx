import { clsx } from 'clsx'

interface BadgeProps {
  label: string
  variant?: 'cold' | 'warm' | 'hot' | 'default'
  className?: string
}

const MAP = {
  cold:    'badge-cold',
  warm:    'badge-warm',
  hot:     'badge-hot',
  default: 'bg-white/5 text-gray-400',
}

export default function Badge({ label, variant = 'default', className }: BadgeProps) {
  return (
    <span className={clsx('badge', MAP[variant], className)}>
      {label}
    </span>
  )
}
