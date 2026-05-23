import { Link } from '@tanstack/react-router'
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Info, RefreshCcw } from 'lucide-react'
import { useMemo } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useValidationScan, type ValidationIssue } from './queries'

const SEVERITY_LABEL = {
  error: { label: 'ผิดพลาด', icon: AlertCircle, color: 'text-destructive' },
  warning: { label: 'ควรแก้', icon: AlertTriangle, color: 'text-amber-600' },
  info: { label: 'ข้อมูล', icon: Info, color: 'text-blue-600' },
}

const ENTITY_LABEL: Record<ValidationIssue['entity'], string> = {
  contract: 'สัญญา',
  invoice: 'ใบแจ้งหนี้',
  tenant: 'ผู้เช่า',
  landlord: 'ผู้ให้เช่า',
  property: 'ทรัพย์สิน',
  bank_account: 'บัญชีธนาคาร',
}

export function ValidationPage() {
  const { data: issues, isLoading, refetch, isFetching } = useValidationScan()

  const grouped = useMemo(() => {
    const errors = (issues ?? []).filter((i) => i.severity === 'error')
    const warnings = (issues ?? []).filter((i) => i.severity === 'warning')
    const info = (issues ?? []).filter((i) => i.severity === 'info')
    return { errors, warnings, info }
  }, [issues])

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        <header className='flex items-start justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              ตรวจสอบข้อมูล
            </h1>
            <p className='text-muted-foreground text-sm'>
              สแกนหาข้อมูลผิด/ไม่ครบในระบบ — ใช้ตอน audit หรือทำความสะอาดข้อมูล
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCcw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            สแกนใหม่
          </Button>
        </header>

        {isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={i} className='h-16 w-full' />
            ))}
          </div>
        ) : issues && issues.length === 0 ? (
          <div className='rounded-md border bg-emerald-50 dark:bg-emerald-950/30 p-6 text-center'>
            <CheckCircle2 className='mx-auto size-10 text-emerald-600 mb-2' />
            <p className='font-medium text-emerald-700 dark:text-emerald-300'>
              ข้อมูลครบถ้วน · ไม่พบปัญหา
            </p>
          </div>
        ) : (
          <div className='space-y-6'>
            {/* Summary */}
            <div className='grid grid-cols-3 gap-3'>
              <SummaryCard severity='error' count={grouped.errors.length} />
              <SummaryCard severity='warning' count={grouped.warnings.length} />
              <SummaryCard severity='info' count={grouped.info.length} />
            </div>

            {/* Sections */}
            <IssueSection title='🔴 ต้องแก้' issues={grouped.errors} />
            <IssueSection title='🟡 ควรตรวจ' issues={grouped.warnings} />
            <IssueSection title='🟢 ข้อมูลเสริม' issues={grouped.info} />
          </div>
        )}
      </Main>
    </>
  )
}

function SummaryCard({
  severity,
  count,
}: {
  severity: ValidationIssue['severity']
  count: number
}) {
  const meta = SEVERITY_LABEL[severity]
  const Icon = meta.icon
  return (
    <div className='rounded-md border bg-card p-4'>
      <div className='flex items-center justify-between'>
        <p className='text-xs font-semibold text-muted-foreground'>{meta.label}</p>
        <Icon className={`size-4 ${meta.color}`} />
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${meta.color}`}>
        {count}
      </p>
    </div>
  )
}

function IssueSection({
  title,
  issues,
}: {
  title: string
  issues: ValidationIssue[]
}) {
  if (issues.length === 0) return null
  return (
    <section className='space-y-2'>
      <h2 className='text-base font-semibold'>{title} ({issues.length})</h2>
      <div className='rounded-md border divide-y'>
        {issues.map((issue) => (
          <div
            key={`${issue.entity}-${issue.entityId}-${issue.rule}`}
            className='flex items-center gap-3 p-3'
          >
            <Badge variant='outline' className='font-normal'>
              {ENTITY_LABEL[issue.entity]}
            </Badge>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium truncate'>{issue.entityLabel}</p>
              <p className='text-xs text-muted-foreground'>{issue.detail}</p>
            </div>
            {issue.link && (
              <Button asChild size='sm' variant='ghost'>
                <Link to={issue.link.to} params={issue.link.params}>
                  ดู <ArrowRight className='size-3' />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
