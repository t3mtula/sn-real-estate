import { Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Pencil,
  RefreshCcw,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
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
            <h1 className='text-2xl font-semibold tracking-tight'>ตรวจสอบข้อมูล</h1>
            <p className='text-muted-foreground text-sm'>
              สแกนหาข้อมูลผิด/ไม่ครบในระบบ — ใช้ตอน audit หรือทำความสะอาดข้อมูล
            </p>
          </div>
          <Button variant='outline' size='sm' onClick={() => refetch()} disabled={isFetching}>
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
            <div className='grid grid-cols-3 gap-3'>
              <SummaryCard severity='error' count={grouped.errors.length} />
              <SummaryCard severity='warning' count={grouped.warnings.length} />
              <SummaryCard severity='info' count={grouped.info.length} />
            </div>
            <IssueSection title='🔴 ต้องแก้' issues={grouped.errors} onFixed={refetch} />
            <IssueSection title='🟡 ควรตรวจ' issues={grouped.warnings} onFixed={refetch} />
            <IssueSection title='🟢 ข้อมูลเสริม' issues={grouped.info} onFixed={refetch} />
          </div>
        )}
      </Main>
    </>
  )
}

function SummaryCard({ severity, count }: { severity: ValidationIssue['severity']; count: number }) {
  const meta = SEVERITY_LABEL[severity]
  const Icon = meta.icon
  return (
    <div className='rounded-md border bg-card p-4'>
      <div className='flex items-center justify-between'>
        <p className='text-xs font-semibold text-muted-foreground'>{meta.label}</p>
        <Icon className={`size-4 ${meta.color}`} />
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${meta.color}`}>{count}</p>
    </div>
  )
}

function IssueSection({
  title,
  issues,
  onFixed,
}: {
  title: string
  issues: ValidationIssue[]
  onFixed: () => void
}) {
  if (issues.length === 0) return null
  return (
    <section className='space-y-2'>
      <h2 className='text-base font-semibold'>
        {title} ({issues.length})
      </h2>
      <div className='rounded-md border divide-y'>
        {issues.map((issue) => (
          <IssueRow
            key={`${issue.entity}-${issue.entityId}-${issue.rule}`}
            issue={issue}
            onFixed={onFixed}
          />
        ))}
      </div>
    </section>
  )
}

function IssueRow({ issue, onFixed }: { issue: ValidationIssue; onFixed: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className='divide-y'>
      {/* Main row */}
      <div className='flex items-center gap-3 p-3'>
        <Badge variant='outline' className='font-normal shrink-0'>
          {ENTITY_LABEL[issue.entity]}
        </Badge>
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-medium truncate'>{issue.entityLabel}</p>
          <p className='text-xs text-muted-foreground'>{issue.detail}</p>
        </div>
        <div className='flex items-center gap-1 shrink-0'>
          {/* Inline fix button — เฉพาะ issue ที่รู้ว่าต้องแก้อะไร */}
          {issue.inlineEdit && (
            <Button
              size='sm'
              variant={expanded ? 'secondary' : 'default'}
              className='h-7 px-2 text-xs gap-1'
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <><X className='size-3' /> ยกเลิก</>
              ) : (
                <><Pencil className='size-3' /> แก้ตรงนี้</>
              )}
            </Button>
          )}
          {/* ดู → link */}
          {issue.link && (
            <Button asChild size='sm' variant='ghost' className='h-7 px-2'>
              <Link to={issue.link.to} params={issue.link.params}>
                ดู <ArrowRight className='size-3' />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Inline edit panel */}
      {expanded && issue.inlineEdit && (
        <div className='bg-muted/30 px-4 py-3'>
          <InlineEditPanel
            issue={issue}
            onSaved={() => {
              setExpanded(false)
              onFixed()
            }}
            onCancel={() => setExpanded(false)}
          />
        </div>
      )}
    </div>
  )
}

function InlineEditPanel({
  issue,
  onSaved,
  onCancel,
}: {
  issue: ValidationIssue
  onSaved: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const [value, setValue] = useState(issue.inlineEdit?.currentValue ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setErr('')
    if (!issue.inlineEdit) return

    if (issue.inlineEdit.type === 'tenant-taxid') {
      const clean = value.replace(/\D/g, '')
      if (clean.length !== 13) {
        setErr('ต้องเป็น 13 หลัก')
        return
      }
      setSaving(true)
      try {
        // Fetch current tenant data then patch
        const { data: row, error: fetchErr } = await supabase
          .from('tenants')
          .select('id, data')
          .eq('id', issue.entityId)
          .single()
        if (fetchErr) throw fetchErr
        const { error } = await supabase
          .from('tenants')
          .update({ data: { ...(row.data as object), taxId: clean }, updated_at: new Date().toISOString() })
          .eq('id', issue.entityId)
        if (error) throw error
        qc.invalidateQueries({ queryKey: ['tenants'] })
        toast.success(`บันทึก taxId ของ ${issue.entityLabel} แล้ว`)
        onSaved()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
      } finally {
        setSaving(false)
      }
    }

    if (issue.inlineEdit.type === 'contract-made-at') {
      const v = value.trim()
      if (!v) {
        setErr('กรุณากรอกสถานที่ทำสัญญา')
        return
      }
      setSaving(true)
      try {
        const { data: row, error: fetchErr } = await supabase
          .from('contracts')
          .select('id, data')
          .eq('id', issue.entityId)
          .single()
        if (fetchErr) throw fetchErr
        const { error } = await supabase
          .from('contracts')
          .update({ data: { ...(row.data as object), madeAt: v }, updated_at: new Date().toISOString() })
          .eq('id', issue.entityId)
        if (error) throw error
        qc.invalidateQueries({ queryKey: ['contracts'] })
        toast.success(`บันทึกสถานที่ทำสัญญา ${issue.entityLabel} แล้ว`)
        onSaved()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
      } finally {
        setSaving(false)
      }
    }
  }

  if (issue.inlineEdit?.type === 'tenant-taxid') {
    return (
      <div className='flex items-end gap-3'>
        <div className='flex-1 max-w-xs'>
          <Label className='text-xs mb-1 block'>เลขผู้เสียภาษี (13 หลัก)</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='1234567890123'
            maxLength={17}
            className='h-8 text-sm font-mono'
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          {err && <p className='mt-1 text-xs text-destructive'>{err}</p>}
        </div>
        <Button size='sm' className='h-8' onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className='size-3 animate-spin' />}
          บันทึก
        </Button>
        <Button size='sm' variant='ghost' className='h-8' onClick={onCancel}>ยกเลิก</Button>
      </div>
    )
  }

  if (issue.inlineEdit?.type === 'contract-made-at') {
    return (
      <div className='flex items-end gap-3'>
        <div className='flex-1 max-w-lg'>
          <Label className='text-xs mb-1 block'>
            สถานที่ทำสัญญา — ชื่อ + ที่อยู่เต็ม เช่น "บริษัท ก จำกัด 46/1 ถ.บ้านโป่ง ต.ปากแรต อ.บ้านโป่ง จ.ราชบุรี 70110"
          </Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='บริษัท สมบัตินภา จำกัด 46/1 ต.ปากแรต อ.บ้านโป่ง จ.ราชบุรี 70110'
            className='h-8 text-sm'
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          {err && <p className='mt-1 text-xs text-destructive'>{err}</p>}
        </div>
        <Button size='sm' className='h-8' onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className='size-3 animate-spin' />}
          บันทึก
        </Button>
        <Button size='sm' variant='ghost' className='h-8' onClick={onCancel}>ยกเลิก</Button>
      </div>
    )
  }

  return null
}
