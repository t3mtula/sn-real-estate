import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  DoorOpen,
  FileText,
  Landmark,
  Link2,
  Pencil,
  Printer,
  Receipt,
  RotateCcw,
  ScrollText,
  UserRound,
  Users,
  XCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/hooks/use-confirm'
import { useBankAccount, useBankAccounts } from '@/features/bank-accounts/queries'
import { ContractForm } from '@/features/contracts/components/contract-form'
import { buildContractPdf } from '@/features/contracts/print/contract-pdf'
import {
  DuplicateContractNoError,
  useCancelContract,
  useRestoreContract,
  useUpdateContract,
  useUpdateMoveOutNotice,
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
import { useLandlord, useLandlords } from '@/features/landlords/queries'
import { useProperty } from '@/features/properties/queries'
import { useTenant, useTenants } from '@/features/tenants/queries'
import { usePdf } from '@/lib/pdf'
import { amt, todayBE } from '@/lib/thai'
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

function fmtMoney(n: number | string | undefined | null): string {
  // v1 legacy data ships rate/deposit as messy strings like
  // "เดือนละ 1,300 บาท (หนึ่งพันสามร้อยบาทถ้วน)". Use amt(symbol:false) which
  // now loose-parses strings → number, or returns "—" if unparseable.
  return amt(n, { symbol: false, decimal: 0 })
}

/**
 * Format contract duration. v1 stores `dur` as free-text like "6 เดือน",
 * "2 ปี 10 เดือน", or just "12". Avoid appending "เดือน" when the string
 * already carries a unit — that's the "ระยะ 6 เดือน เดือน" bug.
 */
function fmtDuration(d: number | string | undefined | null): string {
  if (d == null || d === '') return ''
  const s = String(d).trim()
  if (!s) return ''
  if (/(ปี|เดือน|วัน)/.test(s)) return s
  return `${s} เดือน`
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

  // Legacy contracts (v1 imports) ไม่มี FK → resolve จาก inline strings + invoiceHeaderId match
  const { data: tenants } = useTenants()
  const { data: landlords } = useLandlords()
  const { data: bankAccounts } = useBankAccounts()

  const resolvedTenantId = (() => {
    if (c.tenant_id) return c.tenant_id
    if (!tenants) return ''
    const tax = (c.taxId ?? '').trim()
    const nm = (c.tenant ?? '').trim()
    if (tax) {
      const byTax = tenants.find((t) => (t.data?.taxId ?? '').trim() === tax)
      if (byTax) return byTax.id
    }
    if (nm) {
      const byName = tenants.find((t) => (t.data?.name ?? '').trim() === nm)
      if (byName) return byName.id
    }
    return ''
  })()

  const resolvedLandlordId = (() => {
    if (c.landlord_id) return c.landlord_id
    if (!landlords) return ''
    const headerId = (c.invHeaderId ?? '').trim()
    const nm = (c.landlord ?? '').trim()
    if (headerId) {
      const byHeader = landlords.find(
        (l) => (l.data?.invoiceHeaderId ?? '').trim() === headerId,
      )
      if (byHeader) return byHeader.id
    }
    if (nm) {
      const byName = landlords.find((l) => (l.data?.name ?? '').trim() === nm)
      if (byName) return byName.id
    }
    return ''
  })()

  const resolvedBankAccountId = (() => {
    if (c.bankAccountId) return c.bankAccountId
    if (!bankAccounts || !resolvedLandlordId) return ''
    // Legacy ไม่มี FK · ถ้า landlord มีบัญชีเดียวที่ active → auto-pick
    const ownBanks = bankAccounts.filter(
      (b) => b.data?.ownerLandlordId === resolvedLandlordId && b.data?.active !== false,
    )
    if (ownBanks.length === 1) return ownBanks[0].id
    return ''
  })()

  // รอ queries โหลดก่อน (กัน flash defaults ว่าง → re-mount form ตอน data มา)
  const loading = !tenants || !landlords || !bankAccounts
  if (loading) {
    return (
      <>
        <Skeleton className='h-12 w-72' />
        <Skeleton className='h-64 w-full' />
      </>
    )
  }

  const defaults: ContractFormValues = {
    ...CONTRACT_FORM_DEFAULTS,
    no: c.no ?? '',
    pid_property: (c.pid_property ?? c.pid)?.toString() ?? '',
    tenant_id: resolvedTenantId,
    landlord_id: resolvedLandlordId,
    bankAccountId: resolvedBankAccountId,
    parent_contract_id: c.parent_contract_id ?? '',
    start: c.start ?? '',
    end: c.end ?? '',
    rate: c.rate ?? 0,
    deposit: c.deposit ?? 0,
    dur: c.dur ?? 0,
    payment: c.payment ?? 'รายเดือน',
    purpose: (c.purpose as string) ?? 'พักอาศัย',
    // สถานที่ทำสัญญา: 5 fields ใหม่ · fallback ไป legacy madeAt string ใน line
    madeAtLine: c.madeAtLine ?? c.madeAt ?? '',
    madeAtSubdistrict: c.madeAtSubdistrict ?? '',
    madeAtDistrict: c.madeAtDistrict ?? '',
    madeAtProvince: c.madeAtProvince ?? '',
    madeAtPostal: c.madeAtPostal ?? '',
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
  const [cancelOpen, setCancelOpen] = useState(false)
  const [moveOutOpen, setMoveOutOpen] = useState(false)
  const restore = useRestoreContract(contract.id)
  const confirm = useConfirm()

  async function handleRestore() {
    const ok = await confirm({
      title: 'คืนสถานะสัญญา?',
      description: `สัญญา ${display} จะกลับมาใช้งาน · วันสิ้นสุดจะคืนเป็นค่าเดิม`,
      confirmLabel: 'คืนสถานะ',
    })
    if (!ok) return
    try {
      await restore.mutateAsync()
      toast.success('คืนสถานะสัญญาแล้ว')
    } catch (err) {
      toast.error('คืนสถานะไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Resolve linked entities (only if FK present)
  const tenant = useTenant(c.tenant_id)
  const landlord = useLandlord(c.landlord_id)
  const bank = useBankAccount(c.bankAccountId)
  const propertyId = (c.pid_property ?? c.pid)?.toString() ?? ''
  const property = useProperty(propertyId)
  const parent = useContract(c.parent_contract_id)

  const pdf = usePdf()
  async function handlePrint() {
    const doc = buildContractPdf({
      contract,
      tenant: tenant.data,
      landlord: landlord.data,
      bank: bank.data,
      property: property.data,
      parent: parent.data,
    })
    const safeName = (c.no ?? `#${contract.id}`).replace(/[/\\?%*:|"<>]/g, '_')
    // Generate blob → navigate tab เดิมไป blob URL · Chrome PDF viewer
    // จะ render inline · กด save/ปริ้นจาก viewer + กด back กลับสัญญา
    // ตรงตาม Tem rule "ทุกหน้าเปลี่ยนหน้า · ไม่ overlay" (v1 ใช้ HTML overlay ทาง
    // เดิม · v2 ให้เป็น page-based แทน) + MCP/หน้า preview เห็น PDF จริงได้
    void safeName
    const blob = await pdf.blob(doc)
    if (blob) {
      const url = URL.createObjectURL(blob)
      window.location.assign(url)
    }
  }

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
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            onClick={handlePrint}
            disabled={pdf.generating}
          >
            <Printer className='size-4' />
            {pdf.generating ? 'กำลังสร้าง...' : 'พิมพ์/PDF'}
          </Button>
          {!c.cancelled && (
            <Button variant='outline' asChild>
              <Link
                to='/invoices/new'
                search={{
                  contract: contract.id,
                  month: (() => {
                    const d = new Date()
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                  })(),
                }}
              >
                <Receipt className='size-4' />
                ออกใบแจ้งเดือนนี้
              </Link>
            </Button>
          )}
          {c.cancelled ? (
            <Button
              variant='outline'
              onClick={handleRestore}
              disabled={restore.isPending}
            >
              <RotateCcw className='size-4' />
              คืนสถานะ
            </Button>
          ) : (
            <>
              <Button
                variant='outline'
                onClick={() => setMoveOutOpen(true)}
                className='text-amber-700 hover:text-amber-700 dark:text-amber-300'
              >
                <DoorOpen className='size-4' />
                {c.noticeDate ? 'แก้ไขแจ้งออก' : 'แจ้งย้ายออก'}
              </Button>
              <Button
                variant='outline'
                onClick={() => setCancelOpen(true)}
                className='text-destructive hover:text-destructive'
              >
                <XCircle className='size-4' />
                ยกเลิกสัญญา
              </Button>
            </>
          )}
          <Button onClick={onEdit}>
            <Pencil className='size-4' />
            แก้ไข
          </Button>
        </div>
      </header>

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        contractId={contract.id}
        display={display}
      />
      <MoveOutDialog
        open={moveOutOpen}
        onOpenChange={setMoveOutOpen}
        contractId={contract.id}
        defaults={{
          noticeDate: c.noticeDate ?? '',
          plannedMoveOut: c.plannedMoveOut ?? c.end ?? '',
          noticeNote: c.noticeNote ?? '',
        }}
      />

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
              ) : landlord.data ? (
                <span className='text-xs italic text-muted-foreground'>
                  ยังไม่เลือก ·{' '}
                  <button
                    type='button'
                    onClick={onEdit}
                    className='text-primary underline-offset-4 hover:underline'
                  >
                    เลือกบัญชีในสัญญา
                  </button>
                </span>
              ) : (
                <span className='text-xs italic text-muted-foreground'>
                  ยังไม่เลือก
                </span>
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
              {fmtDuration(c.dur) && (
                <span className='block text-xs text-muted-foreground'>
                  ระยะ {fmtDuration(c.dur)}
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

function CancelDialog({
  open,
  onOpenChange,
  contractId,
  display,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  display: string
}) {
  const cancel = useCancelContract(contractId)
  const [cancelDate, setCancelDate] = useState(todayBE())
  const [reason, setReason] = useState('')

  async function handleConfirm() {
    try {
      await cancel.mutateAsync({ cancelDate, reason })
      toast.success('ยกเลิกสัญญาแล้ว')
      onOpenChange(false)
      setReason('')
    } catch (err) {
      toast.error('ยกเลิกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยกเลิกสัญญา {display}</DialogTitle>
          <DialogDescription>
            สัญญาจะถูกตั้งเป็น "ยกเลิก" · วันสิ้นสุดเดิมจะเก็บไว้สำหรับคืนสถานะภายหลัง
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-2'>
          <div>
            <Label htmlFor='cancelDate'>วันที่ยกเลิก</Label>
            <Input
              id='cancelDate'
              value={cancelDate}
              onChange={(e) => setCancelDate(e.target.value)}
              placeholder='DD/MM/YYYY (พ.ศ.)'
              className='font-mono'
            />
          </div>
          <div>
            <Label htmlFor='cancelReason'>เหตุผล</Label>
            <Textarea
              id='cancelReason'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder='เช่น ผู้เช่าย้ายออก · เลิกกิจการ · ผิดสัญญา ฯลฯ'
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant='ghost'
            onClick={() => onOpenChange(false)}
            disabled={cancel.isPending}
          >
            ปิด
          </Button>
          <Button
            variant='destructive'
            onClick={handleConfirm}
            disabled={cancel.isPending || !cancelDate.trim()}
          >
            ยืนยันยกเลิก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoveOutDialog({
  open,
  onOpenChange,
  contractId,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  defaults: { noticeDate: string; plannedMoveOut: string; noticeNote: string }
}) {
  const upd = useUpdateMoveOutNotice(contractId)
  const [noticeDate, setNoticeDate] = useState(defaults.noticeDate || todayBE())
  const [plannedMoveOut, setPlannedMoveOut] = useState(defaults.plannedMoveOut)
  const [noticeNote, setNoticeNote] = useState(defaults.noticeNote)

  async function handleConfirm() {
    try {
      await upd.mutateAsync({ noticeDate, plannedMoveOut, noticeNote })
      toast.success('บันทึกแจ้งย้ายออกแล้ว')
      onOpenChange(false)
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleClear() {
    try {
      await upd.mutateAsync({ noticeDate: '', plannedMoveOut: '', noticeNote: '' })
      toast.success('ล้างแจ้งย้ายออกแล้ว')
      onOpenChange(false)
      setNoticeDate(todayBE())
      setPlannedMoveOut('')
      setNoticeNote('')
    } catch (err) {
      toast.error('ล้างไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แจ้งย้ายออกล่วงหน้า</DialogTitle>
          <DialogDescription>
            บันทึกแจ้งย้ายออก · ใช้เป็น flag เตือนใน dashboard · ไม่ใช่การยกเลิกสัญญา
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-2'>
          <div>
            <Label htmlFor='noticeDate'>วันที่แจ้ง</Label>
            <Input
              id='noticeDate'
              value={noticeDate}
              onChange={(e) => setNoticeDate(e.target.value)}
              placeholder='DD/MM/YYYY (พ.ศ.)'
              className='font-mono'
            />
          </div>
          <div>
            <Label htmlFor='plannedMoveOut'>กำหนดออกจริง</Label>
            <Input
              id='plannedMoveOut'
              value={plannedMoveOut}
              onChange={(e) => setPlannedMoveOut(e.target.value)}
              placeholder='DD/MM/YYYY (พ.ศ.)'
              className='font-mono'
            />
          </div>
          <div>
            <Label htmlFor='noticeNote'>หมายเหตุ</Label>
            <Textarea
              id='noticeNote'
              value={noticeNote}
              onChange={(e) => setNoticeNote(e.target.value)}
              rows={3}
              placeholder='เช่น ติดต่อทาง LINE · ต้องตรวจห้องก่อน ฯลฯ'
            />
          </div>
        </div>
        <DialogFooter>
          {defaults.noticeDate && (
            <Button
              variant='ghost'
              onClick={handleClear}
              disabled={upd.isPending}
              className='mr-auto text-destructive hover:text-destructive'
            >
              ล้างแจ้งออก
            </Button>
          )}
          <Button
            variant='ghost'
            onClick={() => onOpenChange(false)}
            disabled={upd.isPending}
          >
            ปิด
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={upd.isPending || !noticeDate.trim()}
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
