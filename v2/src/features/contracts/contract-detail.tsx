import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  DoorOpen,
  FileText,
  Landmark,
  Link2,
  Pencil,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  ScrollText,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CopyButton } from '@/components/copy-button'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/hooks/use-confirm'
import { EntityAuditPanel } from '@/features/activity-log/entity-audit-panel'
import { diffContractData } from '@/features/contracts/contract-diff'
import { useBankAccount, useBankAccounts } from '@/features/bank-accounts/queries'
import { useBankAccountsForLandlord } from '@/features/landlord-banks/queries'
import { SubleaseChain } from '@/features/contracts/components/sublease-chain'
import { ClauseOverridePanel } from '@/features/contracts/components/clause-override-panel'
import { InspectionPanel } from '@/features/contracts/components/inspection-panel'
import { DepositReturnPanel } from '@/features/contracts/components/deposit-return-panel'
import { ContractForm } from '@/features/contracts/components/contract-form'
import { ContractTimelineBar } from '@/features/contracts/contract-timeline-bar'
import { buildContractHtml } from '@/features/contracts/print/contract-html'
import { useActiveContractTemplate, useContractTemplate } from '@/features/templates/queries'
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
import { coerceDurMonths, coerceNumber } from '@/lib/contract-normalize'
import { amt, todayBE } from '@/lib/thai'
import { cn } from '@/lib/utils'
import type { ContractStatus } from '@/features/contracts/types'
import { BackButton } from '@/components/yonghua/back-button'

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
            <BackButton fallback='/contracts' variant='text' />
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !contract ? (
          <>
            <BackButton fallback='/contracts' variant='text' />
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

  const { data: landlordBankAccounts } = useBankAccountsForLandlord(resolvedLandlordId)
  const resolvedBankAccountId = (() => {
    if (c.bankAccountId) return String(c.bankAccountId)
    if (!landlordBankAccounts || !resolvedLandlordId) return ''
    // Legacy ไม่มี FK · ถ้า landlord มีบัญชีเดียวที่ active → auto-pick
    const ownBanks = landlordBankAccounts.filter((b) => b.data?.active !== false)
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
    // rate = ข้อความในสัญญา · ถ้าเป็น legacy number → reconstruct จาก rateFreq
    rate: (() => {
      const r = c.rate
      if (typeof r === 'string' && r.trim()) return r
      const amount = coerceNumber(r)
      if (!amount) return ''
      const rf = (c as any).rateFreq
      if (rf === 'annual') return `ปีละ ${amount.toLocaleString('th-TH')} บาท`
      if (rf === 'quarterly') return `ไตรมาสละ ${amount.toLocaleString('th-TH')} บาท`
      return `เดือนละ ${amount.toLocaleString('th-TH')} บาท`
    })(),
    rateAmount: (() => {
      const ra = (c as any).rateAmount
      if (typeof ra === 'number' && ra > 0) return ra
      return coerceNumber(c.rate)
    })(),
    rateIntervalMonths: (() => {
      const ri = (c as any).rateIntervalMonths
      if (typeof ri === 'number' && ri >= 1) return ri
      // Infer from legacy rateFreq
      const rf = (c as any).rateFreq
      if (rf === 'quarterly') return 3
      if (rf === 'annual') return 12
      // Infer from rate Thai string
      const rStr = String(c.rate ?? '')
      if (rStr.includes('ไตรมาส')) return 3
      if (rStr.includes('ปี')) return 12
      return 1
    })(),
    billingStart: (c as any).billingStart ?? '',
    deposit: coerceNumber(c.deposit),
    dur: coerceNumber((c as any).durMonths) || coerceDurMonths(c.dur),
    // Hydrate payment from existing data — DO NOT default to 'รายเดือน' which
    // silently corrupts lump-sum/annual contracts. If c.payment missing,
    // derive from structured payFreq · else empty (staff fills in).
    payment: (() => {
      if (c.payment) return c.payment
      const pf = (c as { payFreq?: string }).payFreq
      if (pf === 'lump') return 'จ่ายครั้งเดียว'
      if (pf === 'annual') return 'รายปี'
      if (pf === 'semiannual') return 'ครึ่งปี'
      if (pf === 'quarterly') return 'รายไตรมาส'
      if (pf === 'monthly') return 'รายเดือน'
      return ''
    })(),
    purpose: (c.purpose as string) ?? 'พักอาศัย',
    tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
    spot: c.spot ?? '',
    dueDay: c.dueDay ?? 5,
    rateAdj: c.rateAdj ?? '',
    // สถานที่ทำสัญญา: 5 fields ใหม่ · fallback ไป legacy madeAt string ใน line
    madeAtLine: c.madeAtLine ?? c.madeAt ?? '',
    madeAtSubdistrict: c.madeAtSubdistrict ?? '',
    madeAtDistrict: c.madeAtDistrict ?? '',
    madeAtProvince: c.madeAtProvince ?? '',
    madeAtPostal: c.madeAtPostal ?? '',
    madeDate: c.madeDate ?? '',
    wit1: c.wit1 ?? '',
    wit2: c.wit2 ?? '',
    templateId: c.templateId ?? '',
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
  const [moveOutExpanded, setMoveOutExpanded] = useState(false)
  // printHtml state removed — now opens in new tab directly
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
  const activeTemplate = useActiveContractTemplate()
  const specificTemplate = useContractTemplate(c.templateId)
  const template = c.templateId ? specificTemplate : activeTemplate

  function handlePrint() {
    const html = buildContractHtml(
      {
        contract,
        tenant: tenant.data,
        landlord: landlord.data,
        bank: bank.data,
        property: property.data,
        parent: parent.data,
        template: template.data,
      },
      { embed: false }, // show toolbar (พิมพ์ / บันทึก PDF button) in new tab
    )
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // blob URL จะถูก browser ล้างเองเมื่อ tab ปิด
  }

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <BackButton fallback='/contracts' />
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
          <Button variant='outline' onClick={handlePrint}>
            <Printer className='size-4' />
            พิมพ์/PDF
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
          {!c.cancelled && (
            <>
              <Button variant='outline' asChild>
                <Link to='/contracts/new' search={{ renewFrom: contract.id }}>
                  <RefreshCw className='size-4' />
                  ต่อสัญญา
                </Link>
              </Button>
              <Button variant='outline' asChild>
                <Link to='/contracts/new' search={{ copyFrom: contract.id }}>
                  <Copy className='size-4' />
                  คัดลอก
                </Link>
              </Button>
            </>
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
                className='text-destructive hover:bg-destructive/10 hover:text-destructive'
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
                <span className='inline-flex items-center gap-1'>
                  <Link
                    to='/bank-accounts/$id'
                    params={{ id: bank.data.id }}
                    className='text-primary underline-offset-4 hover:underline'
                  >
                    {bank.data.data?.bank} · {bank.data.data?.acctNo}
                  </Link>
                  {bank.data.data?.acctNo && (
                    <CopyButton
                      text={bank.data.data.acctNo}
                      label='คัดลอกเลขบัญชี'
                    />
                  )}
                </span>
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
              <ContractTimelineBar
                start={c.start}
                end={c.end}
                cancelled={!!c.cancelled}
              />
              {fmtDuration(c.dur) && (
                <span className='mt-1 block text-xs text-muted-foreground'>
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
            {c.spot && (
              <InfoRow icon={Building2} label='จุด/ล็อก'>
                <span>{c.spot}</span>
              </InfoRow>
            )}
            {c.dueDay && (
              <InfoRow icon={Calendar} label='วันครบกำหนดใบแจ้งหนี้'>
                <span>วันที่ {c.dueDay} ของทุกเดือน</span>
              </InfoRow>
            )}
            {c.rateAdj && (
              <InfoRow icon={ScrollText} label='การปรับค่าเช่า'>
                <span>{c.rateAdj}</span>
              </InfoRow>
            )}
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

      <SubleaseChain contract={contract} />
      <ClauseOverridePanel contract={contract} />

      {/* ─── การย้ายออก ─── */}
      {(() => {
        const showSection = c.cancelled || !!c.noticeDate || c.inspection || c.depositReturn
        const isExpanded = showSection || moveOutExpanded

        return (
          <div className='rounded-md border'>
            <button
              type='button'
              className='flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors'
              onClick={() => !showSection && setMoveOutExpanded((prev) => !prev)}
            >
              <div className='flex items-center gap-2'>
                <DoorOpen className='size-4 text-muted-foreground' />
                <span className='text-sm font-medium'>การย้ายออก</span>
                {c.depositReturn && (
                  <span className='rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300'>
                    ปิดแล้ว
                  </span>
                )}
                {!c.depositReturn && c.inspection && (
                  <span className='rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300'>
                    ตรวจแล้ว
                  </span>
                )}
                {!c.depositReturn && !c.inspection && c.noticeDate && (
                  <span className='rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300'>
                    แจ้งออกแล้ว
                  </span>
                )}
              </div>
              {!showSection && (
                <span className='text-xs text-muted-foreground flex items-center gap-1'>
                  {moveOutExpanded ? 'ย่อ' : 'เริ่มกระบวนการย้ายออก'}
                  {moveOutExpanded ? <ChevronUp className='size-3' /> : <ChevronDown className='size-3' />}
                </span>
              )}
            </button>

            {isExpanded && (
              <div className='border-t p-4 space-y-4'>
                {/* 1. แจ้งออก */}
                {c.noticeDate && (
                  <div className='space-y-1'>
                    <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>แจ้งออก</p>
                    <div className='rounded-md border bg-muted/20 px-3 py-2 text-sm space-y-1'>
                      <div className='flex gap-6'>
                        <span className='text-muted-foreground'>วันแจ้ง</span>
                        <span className='font-medium'>{c.noticeDate}</span>
                      </div>
                      <div className='flex gap-6'>
                        <span className='text-muted-foreground'>กำหนดออก</span>
                        <span className='font-medium'>{c.plannedMoveOut || '—'}</span>
                      </div>
                      {c.noticeNote && (
                        <div className='text-xs text-muted-foreground pt-1'>{c.noticeNote}</div>
                      )}
                    </div>
                  </div>
                )}

                {c.noticeDate && (c.inspection || c.depositReturn) && <Separator />}

                {/* 2. ผลตรวจรับคืน */}
                <div className='space-y-1'>
                  {c.noticeDate && (
                    <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>ผลตรวจรับคืน</p>
                  )}
                  <InspectionPanel contract={contract} />
                </div>

                <Separator />

                {/* 3. คืนเงินประกัน */}
                <div className='space-y-1'>
                  <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>คืนเงินประกัน</p>
                  <DepositReturnPanel contract={contract} />
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <EntityAuditPanel entity='contracts' entityId={contract.id} diffFn={diffContractData} />

      {/* PrintOverlay removed — contract now opens in new browser tab */}
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
