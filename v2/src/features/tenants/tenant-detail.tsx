import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  MapPin,
  Pencil,
  Phone,
  ScrollText,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfirm } from '@/hooks/use-confirm'
import {
  fmtTaxId,
  getPartyLabel,
  getTenantAddrShort,
  getTenantName,
  useTenant,
  useTenantContracts,
} from '@/features/tenants/queries'
import { useDeleteTenant } from '@/features/tenants/mutations'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    const beYear = d.getFullYear() + 543
    const month = d.toLocaleDateString('th-TH', { month: 'short' })
    const day = d.getDate()
    return `${day} ${month} ${String(beYear).slice(2)}`
  } catch {
    return '—'
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | undefined
}) {
  return (
    <div className='flex gap-3'>
      <div className='mt-0.5'>
        <Icon className='size-4 text-muted-foreground' />
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-xs uppercase tracking-wider text-muted-foreground'>
          {label}
        </p>
        <p className='text-sm'>{value?.trim() || '—'}</p>
      </div>
    </div>
  )
}

export function TenantDetail({ id }: { id: string }) {
  const { data: tenant, isLoading, error } = useTenant(id)
  const contracts = useTenantContracts(tenant ?? null)
  const del = useDeleteTenant()
  const confirm = useConfirm()
  const navigate = useNavigate()

  async function handleDelete() {
    if (!tenant) return
    const linkedCount = contracts.data?.length ?? 0
    const ok = await confirm({
      title: `ลบผู้เช่า "${getTenantName(tenant.data)}"?`,
      description:
        linkedCount > 0
          ? `ผู้เช่ารายนี้มี ${linkedCount} สัญญาผูกอยู่ · ลบแล้วสัญญายังอยู่แต่จะหาผู้เช่ารายนี้ไม่เจอ`
          : 'ลบแล้วเรียกคืนไม่ได้',
      confirmLabel: 'ลบ',
      destructive: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(tenant.id)
      toast.success('ลบผู้เช่าแล้ว')
      navigate({ to: '/tenants' })
    } catch (err) {
      toast.error('ลบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        {isLoading ? (
          <>
            <Skeleton className='h-12 w-72' />
            <Skeleton className='h-64 w-full' />
          </>
        ) : error ? (
          <>
            <Button variant='ghost' size='sm' asChild className='self-start'>
              <Link to='/tenants'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !tenant ? (
          <>
            <Button variant='ghost' size='sm' asChild className='self-start'>
              <Link to='/tenants'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบผู้เช่า</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                ผู้เช่า ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code> ไม่มีในระบบ
              </CardContent>
            </Card>
          </>
        ) : (
          <Content tenant={tenant} contracts={contracts.data ?? []} onDelete={handleDelete} deleting={del.isPending} />
        )}
      </Main>
    </>
  )
}

function Content({
  tenant,
  contracts,
  onDelete,
  deleting,
}: {
  tenant: NonNullable<ReturnType<typeof useTenant>['data']>
  contracts: Array<{ id: string; data: Record<string, unknown> }>
  onDelete: () => Promise<void>
  deleting: boolean
}) {
  const t = tenant.data
  const isCompany = t.partyType === 'company'
  const Icon = isCompany ? Building2 : UserRound
  const addr = getTenantAddrShort(t)

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <Button variant='ghost' size='icon' asChild className='mt-0.5'>
            <Link to='/tenants' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <Icon className='size-5 text-muted-foreground' />
              <h1 className='text-2xl font-semibold tracking-tight'>
                {getTenantName(t)}
              </h1>
              <Badge variant='secondary' className='font-normal'>
                {getPartyLabel(t.partyType)}
              </Badge>
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>
              ID:{' '}
              <code className='rounded bg-muted px-1.5 py-0.5'>{tenant.id}</code>
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={onDelete} disabled={deleting}>
            <Trash2 className='size-4' />
            ลบ
          </Button>
          <Button asChild>
            <Link to='/tenants/$id/edit' params={{ id: tenant.id }}>
              <Pencil className='size-4' />
              แก้ไข
            </Link>
          </Button>
        </div>
      </header>

      <div className='grid gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลผู้เช่า</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-5 sm:grid-cols-2'>
            <InfoRow
              icon={ScrollText}
              label='เลขผู้เสียภาษี / Passport'
              value={fmtTaxId(t.taxId)}
            />
            {isCompany && (
              <InfoRow icon={Building2} label='สาขา' value={t.branch} />
            )}
            <InfoRow icon={Phone} label='เบอร์โทร' value={t.phone} />
            <div className='sm:col-span-2'>
              <InfoRow icon={MapPin} label='ที่อยู่' value={addr} />
            </div>
            {isCompany && (
              <>
                <InfoRow icon={UserRound} label='ชื่อกรรมการ' value={t.signerName} />
                <InfoRow icon={UserRound} label='ตำแหน่ง' value={t.signerTitle} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลระบบ</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>รหัส (pid)</span>
              <span className='font-medium'>{t.pid ?? '—'}</span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>เพิ่มเมื่อ</span>
              <span className='font-medium'>{formatDate(tenant.created_at)}</span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>แก้ไขล่าสุด</span>
              <span className='font-medium'>{formatDate(tenant.updated_at)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle className='text-base'>
              สัญญาเช่าที่เกี่ยวข้อง ({contracts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                ผู้เช่ารายนี้ยังไม่มีสัญญา · หรือสัญญายังไม่ได้ผูกผู้เช่าใน v2
              </p>
            ) : (
              <ul className='divide-y'>
                {contracts.map((c) => {
                  const cd = c.data as {
                    no?: string
                    property?: string
                    start?: string
                    end?: string
                    status?: string
                  }
                  return (
                    <li
                      key={c.id}
                      className='flex items-center justify-between gap-2 py-2 text-sm'
                    >
                      <div className='min-w-0'>
                        <p className='font-medium'>
                          {cd.no ?? `#${c.id}`}
                        </p>
                        <p className='truncate text-xs text-muted-foreground'>
                          {cd.property ?? '—'} · {cd.start ?? '—'} → {cd.end ?? '—'}
                        </p>
                      </div>
                      {cd.status && (
                        <Badge variant='outline' className='shrink-0 font-normal'>
                          {cd.status}
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
