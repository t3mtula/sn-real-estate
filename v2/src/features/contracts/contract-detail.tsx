import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Landmark,
  Link2,
  Pencil,
  ScrollText,
  UserRound,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccount } from '@/features/bank-accounts/queries'
import { ContractForm } from '@/features/contracts/components/contract-form'
import {
  DuplicateContractNoError,
  useUpdateContract,
} from '@/features/contracts/mutations'
import {
  getContractDisplay,
  getContractStatus,
  getStatusMeta,
  useContract,
} from '@/features/contracts/queries'
import {
  CONTRACT_FORM_DEFAULTS,
  type ContractFormValues,
} from '@/features/contracts/schema'
import { useLandlord } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant } from '@/features/tenants/queries'
import { cn } from '@/lib/utils'
import type { ContractStatus } from '@/features/contracts/types'

const STATUS_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  muted: 'bg-muted text-muted-foreground border-border',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = getStatusMeta(status)
  return (
    <Badge
      variant='outline'
      className={cn('font-normal', STATUS_TONE_CLASS[meta.tone] ?? '')}
    >
      {meta.label}
    </Badge>
  )
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    const beYear = d.getFullYear() + 543
    const month = d.toLocaleDateString('th-TH', { month: 'short' })
    return `${d.getDate()} ${month} ${String(beYear).slice(2)}`
  } catch {
    return '—'
  }
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
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
        <div className='text-sm'>{children}</div>
      </div>
    </div>
  )
}

function fmtMoney(n: number | undefined): string {
  if (n == null || n === 0) return '—'
  return Number(n).toLocaleString('th-TH')
}

export function ContractDetail({ id }: { id: string }) {
  const { data: contract, isLoading, error } = useContract(id)
  const [isEditing, setIsEditing] = useState(false)

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
              <Link to='/contracts'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !contract ? (
          <>
            <Button variant='ghost' size='sm' asChild className='self-start'>
              <Link to='/contracts'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบสัญญา</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                สัญญา ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>{' '}
                ไม่มีในระบบ
              </CardContent>
            </Card>
          </>
        ) : isEditing ? (
          <ContractEditing
            contract={contract}
            onDone={() => setIsEditing(false)}
          />
        ) : (
          <Content
            contract={contract}
            onEdit={() => setIsEditing(true)}
          />
        )}
      </Main>
    </>
  )
}

function ContractEditing({
  contract,
  onDone,
}: {
  contract: NonNullable<ReturnType<typeof useContract>['data']>
  onDone: () => void
}) {
  const update = useUpdateContract(contract.id)
  const navigate = useNavigate()
  const c = contract.data

  const defaults: ContractFormValues = {
    ...CONTRACT_FORM_DEFAULTS,
    no: c.no ?? '',
    pid_property: (c.pid_property ?? c.pid)?.toString() ?? '',
    tenant_id: c.tenant_id ?? '',
    landlord_id: c.landlord_id ?? '',
    bankAccountId: c.bankAccountId ?? '',
    parent_contract_id: c.parent_contract_id ?? '',
    start: c.start ?? '',
    end: c.end ?? '',
    rate: c.rate ?? 0,
    deposit: c.deposit ?? 0,
    dur: c.dur ?? 0,
    payment: c.payment ?? 'รายเดือน',
    purpose: (c.purpose as string) ?? 'พักอาศัย',
    madeAt: c.madeAt ?? '',
    madeDate: c.madeDate ?? '',
    wit1: c.wit1 ?? '',
    wit2: c.wit2 ?? '',
  }

  return (
    <>
      <header className='flex items-center gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight'>แก้ไขสัญญา</h1>
        <p className='text-sm text-muted-foreground'>
          {c.no || `ID: ${contract.id}`}
        </p>
      </header>
      <ContractForm
        mode='edit'
        contractId={contract.id}
        defaultValues={defaults}
        submitting={update.isPending}
        onCancel={onDone}
        onSubmit={async (values, inline) => {
          try {
            await update.mutateAsync({ values, inline })
            onDone()
          } catch (err) {
            if (err instanceof DuplicateContractNoError) {
              toast.error('เลขสัญญาซ้ำ', {
                description: `เลขนี้อยู่ในสัญญาของ "${err.conflictTenant}"`,
                action: {
                  label: 'ดู',
                  onClick: () =>
                    navigate({
                      to: '/contracts/$id',
                      params: { id: err.conflictId },
                    }),
                },
              })
              return
            }
            throw err
          }
        }}
      />
    </>
  )
}

function Content({
  contract,
  onEdit,
}: {
  contract: NonNullable<ReturnType<typeof useContract>['data']>
  onEdit: () => void
}) {
  const c = contract.data
  const status = getContractStatus(c)
  const display = getContractDisplay(contract)

  // Resolve linked entities (only if FK present)
  const tenant = useTenant(c.tenant_id)
  const landlord = useLandlord(c.landlord_id)
  const bank = useBankAccount(c.bankAccountId)
  // Resolve property by data.pid_property → properties.data.pid lookup
  // For now, use legacy contract.data.pid (v1) which maps to property.data.pid
  // (Property feature has no useProperty-by-pid · skip for subphase 1)
  const propertyId = (c.pid_property ?? c.pid)?.toString() ?? ''
  const property = useProperty(propertyId)

  const parent = useContract(c.parent_contract_id)

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <Button variant='ghost' size='icon' asChild className='mt-0.5'>
            <Link to='/contracts' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <FileText className='size-5 text-muted-foreground' />
              <h1 className='text-2xl font-semibold tracking-tight'>
                {display}
              </h1>
              <StatusBadge status={status} />
              {c.parent_contract_id && (
                <Badge variant='outline' className='font-normal'>
                  เช่าช่วง
                </Badge>
              )}
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>
              ID:{' '}
              <code className='rounded bg-muted px-1.5 py-0.5'>{contract.id}</code>
            </p>
          </div>
        </div>
        <Button onClick={onEdit}>
          <Pencil className='size-4' />
          แก้ไข
        </Button>
      </header>

      {c.cancelled && (
        <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
          <div className='flex items-start gap-2'>
            <AlertCircle className='mt-0.5 size-4 shrink-0' />
            <div>
              <p className='font-medium'>สัญญานี้ถูกยกเลิก</p>
              <p className='mt-1'>
                ยกเลิกเมื่อ {c.cancelledDate || '—'}
                {c.cancelledReason ? ` · ${c.cancelledReason}` : ''}
              </p>
              {c.originalEnd && (
                <p className='mt-0.5 text-xs opacity-80'>
                  สิ้นสุดเดิมตามสัญญา: {c.originalEnd}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {c.noticeDate && !c.cancelled && (
        <div className='rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100'>
          <div className='flex items-start gap-2'>
            <AlertCircle className='mt-0.5 size-4 shrink-0' />
            <div>
              <p className='font-medium'>ผู้เช่าแจ้งย้ายออก</p>
              <p className='mt-1'>
                แจ้งเมื่อ {c.noticeDate} · กำหนดออก {c.plannedMoveOut || '—'}
              </p>
              {c.noticeNote && <p className='mt-0.5 text-xs opacity-80'>{c.noticeNote}</p>}
            </div>
          </div>
        </div>
      )}

      <div className='grid gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>คู่สัญญา</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-5 sm:grid-cols-2'>
            <InfoRow icon={UserRound} label='ผู้เช่า'>
              {tenant.data ? (
                <Link
                  to='/tenants/$id'
                  params={{ id: tenant.data.id }}
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {tenant.data.data?.name ?? '(ไม่มีชื่อ)'}
                </Link>
              ) : (
                <span>{c.tenant?.trim() || '—'}</span>
              )}
              {c.taxId && (
                <span className='block text-xs text-muted-foreground'>
                  ภาษี: {c.taxId}
                </span>
              )}
            </InfoRow>

            <InfoRow icon={Users} label='ผู้ให้เช่า (ตามสัญญา)'>
              {landlord.data ? (
                <Link
                  to='/landlords/$id'
                  params={{ id: landlord.data.id }}
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {landlord.data.data?.name ?? '(ไม่มีชื่อ)'}
                </Link>
              ) : (
                <span>{c.landlord?.trim() || '—'}</span>
              )}
            </InfoRow>

            <InfoRow icon={Building2} label='ทรัพย์สิน'>
              {property.data ? (
                <Link
                  to='/properties/$id'
                  params={{ id: property.data.id }}
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {property.data.data?.name ?? '(ไม่มีชื่อ)'}
                </Link>
              ) : (
                <span className='text-muted-foreground'>—</span>
              )}
            </InfoRow>

            <InfoRow icon={CreditCard} label='บัญชีรับเงิน'>
              {bank.data ? (
                <Link
                  to='/bank-accounts/$id'
                  params={{ id: bank.data.id }}
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {bank.data.data?.bank} · {bank.data.data?.acctNo}
                </Link>
              ) : (
                <span className='text-muted-foreground'>—</span>
              )}
            </InfoRow>

            {c.parent_contract_id && (
              <div className='sm:col-span-2'>
                <InfoRow icon={Link2} label='เช่าช่วงจาก'>
                  {parent.data ? (
                    <Link
                      to='/contracts/$id'
                      params={{ id: parent.data.id }}
                      className='text-primary underline-offset-4 hover:underline'
                    >
                      {getContractDisplay(parent.data)}
                    </Link>
                  ) : (
                    <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>
                      {c.parent_contract_id}
                    </code>
                  )}
                </InfoRow>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>สรุปสัญญา</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-5'>
            <InfoRow icon={Calendar} label='ช่วงเวลา'>
              <span className='tabular-nums'>
                {c.start || '—'} → {c.end || '—'}
              </span>
              {c.dur && (
                <span className='block text-xs text-muted-foreground'>
                  ระยะ {c.dur} เดือน
                </span>
              )}
            </InfoRow>
            <InfoRow icon={ScrollText} label='ค่าเช่า'>
              <span className='tabular-nums'>{fmtMoney(c.rate)}</span>
              {c.payment && (
                <span className='block text-xs text-muted-foreground'>
                  {c.payment}
                </span>
              )}
            </InfoRow>
            <InfoRow icon={Landmark} label='เงินมัดจำ'>
              <span className='tabular-nums'>{fmtMoney(c.deposit)}</span>
            </InfoRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>การลงนาม</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <InfoRow icon={Calendar} label='วันที่ทำสัญญา'>
              <span>{c.madeDate || '—'}</span>
            </InfoRow>
            <InfoRow icon={Building2} label='สถานที่'>
              <span>{c.madeAt || '—'}</span>
            </InfoRow>
            {(c.wit1 || c.wit2) && (
              <InfoRow icon={UserRound} label='พยาน'>
                <span className='block'>1. {c.wit1 || '—'}</span>
                <span className='block'>2. {c.wit2 || '—'}</span>
              </InfoRow>
            )}
            {c.tenantSignerName && (
              <InfoRow icon={UserRound} label='ผู้ลงนาม (ฝั่งผู้เช่า)'>
                <span className='block'>{c.tenantSignerName}</span>
                {c.tenantSignerTitle && (
                  <span className='block text-xs text-muted-foreground'>
                    {c.tenantSignerTitle}
                  </span>
                )}
              </InfoRow>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลระบบ</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>รหัส (legacy pid)</span>
              <span className='font-medium tabular-nums'>{c.pid ?? '—'}</span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>เพิ่มเมื่อ</span>
              <span className='font-medium'>{formatTimestamp(contract.created_at)}</span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>แก้ไขล่าสุด</span>
              <span className='font-medium'>{formatTimestamp(contract.updated_at)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

    </>
  )
}
