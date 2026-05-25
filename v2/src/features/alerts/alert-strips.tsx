import { AlertTriangle, ArrowRight, CircleDollarSign, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useAlerts, type AlertStrip } from './use-alerts'

const ICONS: Record<string, React.ElementType> = {
  overdue: AlertTriangle,
  'dq-errors': ShieldAlert,
  'deposit-unpaid': CircleDollarSign,
  'deposit-return': RotateCcw,
  'dq-warnings': ShieldCheck,
}

const STYLES = {
  critical: {
    wrap: 'border-red-500/30 bg-red-500/5 hover:bg-red-500/[0.08] dark:bg-red-500/[0.08] dark:hover:bg-red-500/[0.12]',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-800 dark:text-red-200',
    desc: 'text-red-700/70 dark:text-red-300/70',
  },
  warning: {
    wrap: 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/[0.08] dark:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.12]',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-200',
    desc: 'text-amber-700/70 dark:text-amber-300/70',
  },
} as const

function StripRow({ strip }: { strip: AlertStrip }) {
  const st = STYLES[strip.severity]
  const Icon = ICONS[strip.id] ?? AlertTriangle
  return (
    <Link
      to={strip.to as never}
      className={cn(
        'flex items-center gap-3 rounded-md border px-4 py-2.5 transition-colors',
        st.wrap,
      )}
    >
      <Icon className={cn('size-4 shrink-0', st.icon)} />
      <div className='min-w-0 flex-1'>
        <span className={cn('text-sm font-semibold', st.title)}>{strip.title}</span>
        <span className={cn('mx-2 text-xs opacity-50', st.icon)}>·</span>
        <span className={cn('text-xs', st.desc)}>{strip.description}</span>
      </div>
      <ArrowRight className={cn('size-3.5 shrink-0 opacity-40', st.icon)} />
    </Link>
  )
}

/** Alert summary strips — render above TodayPanel on dashboard. Only renders when alerts exist. */
export function AlertStrips() {
  const { strips } = useAlerts()
  if (strips.length === 0) return null
  return (
    <section className='flex flex-col gap-1.5'>
      {strips.map((s) => (
        <StripRow key={s.id} strip={s} />
      ))}
    </section>
  )
}
