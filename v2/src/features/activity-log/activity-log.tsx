import { Link } from '@tanstack/react-router'
import { Activity, RefreshCcw, Search, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  distinctEntities,
  getActionLabel,
  getActionTone,
  getEntityLabel,
  type AuditAction,
  useAuditLog,
} from '@/features/activity-log/queries'
import { cn } from '@/lib/utils'

const ACTION_FILTER_OPTIONS: Array<{
  value: 'all' | AuditAction
  label: string
}> = [
  { value: 'all', label: 'ทุกการกระทำ' },
  { value: 'create', label: 'สร้าง' },
  { value: 'update', label: 'แก้ไข' },
  { value: 'delete', label: 'ลบ' },
  { value: 'restore', label: 'กู้คืน' },
  { value: 'login', label: 'เข้าสู่ระบบ' },
]

function buildEntityLink(
  entity: string,
  entityId: string,
):
  | { to: '/contracts/$id'; params: { id: string } }
  | { to: '/invoices/$id'; params: { id: string } }
  | { to: '/tenants/$id'; params: { id: string } }
  | { to: '/landlords/$id'; params: { id: string } }
  | { to: '/properties/$id'; params: { id: string } }
  | { to: '/bank-accounts/$id'; params: { id: string } }
  | { to: '/templates/$id'; params: { id: string } }
  | null {
  if (/[\/\s]/.test(entityId)) return null
  switch (entity) {
    case 'contracts':
      return { to: '/contracts/$id', params: { id: entityId } }
    case 'invoices':
      return { to: '/invoices/$id', params: { id: entityId } }
    case 'tenants':
      return { to: '/tenants/$id', params: { id: entityId } }
    case 'landlords':
      return { to: '/landlords/$id', params: { id: entityId } }
    case 'properties':
      return { to: '/properties/$id', params: { id: entityId } }
    case 'bank_accounts':
      return { to: '/bank-accounts/$id', params: { id: entityId } }
    case 'contract_templates':
      return { to: '/templates/$id', params: { id: entityId } }
    default:
      return null
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yearBE = d.getFullYear() + 543
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${mo}/${yearBE} ${hh}:${mm}`
}

export function ActivityLog() {
  const { data, isLoading, refetch, isFetching } = useAuditLog({ limit: 500 })
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<'all' | AuditAction>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')

  const entities = useMemo(() => distinctEntities(data ?? []), [data])

  const rows = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false
      if (entityFilter !== 'all' && r.entity !== entityFilter) return false
      if (!q) return true
      const hay = [
        r.description,
        r.user_email,
        r.entity_id,
        getEntityLabel(r.entity),
        r.entity,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [data, search, actionFilter, entityFilter])

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <header className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>บันทึกกิจกรรม</h1>
            <p className='text-sm text-muted-foreground'>
              ใครทำอะไร · เมื่อไหร่ · ของอะไร (ทั้งระบบ)
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCcw className={cn('size-4', isFetching && 'animate-spin')} />
            รีเฟรช
          </Button>
        </header>

        <div className='flex flex-wrap items-center gap-3'>
          <div className='relative max-w-sm flex-1'>
            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='ค้น คำอธิบาย · email · entity id ...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='pl-9'
            />
          </div>
          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v as 'all' | AuditAction)}
          >
            <SelectTrigger className='w-[160px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='ทุก entity' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>ทุก entity</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e}>
                  {getEntityLabel(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={`sk-${i}`} className='h-14 w-full' />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className='rounded-md border bg-card p-10 text-center text-sm text-muted-foreground'>
            <Activity className='mx-auto mb-2 size-8 text-muted-foreground/50' />
            ยังไม่มีบันทึกที่ตรงเงื่อนไข
          </div>
        ) : (
          <div className='overflow-hidden rounded-md border bg-card'>
            {rows.map((r, i) => {
              const link = r.entity_id
                ? buildEntityLink(r.entity, r.entity_id)
                : null
              const content = (
                <div className='flex items-start justify-between gap-3 px-4 py-3 text-sm'>
                  <div className='flex min-w-0 items-start gap-3'>
                    <Badge
                      variant='outline'
                      className={cn('mt-0.5 shrink-0 font-normal', getActionTone(r.action))}
                    >
                      {getActionLabel(r.action)}
                    </Badge>
                    <div className='min-w-0'>
                      <p className='text-sm'>
                        <span className='text-muted-foreground'>{getEntityLabel(r.entity)}</span>
                        {' · '}
                        <span className='font-medium'>
                          {r.description?.trim() || '(ไม่มีคำอธิบาย)'}
                        </span>
                      </p>
                      <p className='mt-0.5 flex items-center gap-2 text-xs text-muted-foreground'>
                        <span className='inline-flex items-center gap-1'>
                          <User className='size-3' />
                          {r.user_email || '—'}
                        </span>
                        <span>·</span>
                        <span className='tabular-nums'>{formatTime(r.created_at)}</span>
                        {r.entity_id && (
                          <>
                            <span>·</span>
                            <code className='rounded bg-muted/60 px-1 py-0.5 text-[10px] tabular-nums'>
                              {r.entity_id}
                            </code>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )
              return (
                <div
                  key={r.id}
                  className={cn(
                    'transition hover:bg-muted/30',
                    i > 0 && 'border-t',
                  )}
                >
                  {link ? (
                    <Link to={link.to} params={link.params} className='block'>
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Main>
    </>
  )
}
