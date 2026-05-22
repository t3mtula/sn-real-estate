import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Landmark,
  MapPin,
  Pencil,
  Percent,
  Phone,
  Plus,
  QrCode,
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
  getLandlordAddrShort,
  getLandlordName,
  getPartyLabel,
  useLandlord,
  useLandlordContracts,
} from '@/features/landlords/queries'
import { useDeleteLandlord } from '@/features/landlords/mutations'
import { useBankAccountsByOwner } from '@/features/bank-accounts/queries'

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

export function LandlordDetail({ id }: { id: string }) {
  const { data: landlord, isLoading, error } = useLandlord(id)
  const contracts = useLandlordContracts(landlord ?? null)
  const banks = useBankAccountsByOwner(id)
  const del = useDeleteLandlord()
  const confirm = useConfirm()
  const navigate = useNavigate()

  async function handleDelete() {
    if (!landlord) return
    const linkedCount = contracts.data?.length ?? 0
    const ok = await confirm({
      title: `ลบผู้ให้เช่า "${getLandlordName(landlord.data)}"?`,
      description:
        linkedCount > 0
          ? `รายนี้มี ${linkedCount} สัญญาผูกอยู่ · ลบแล้วสัญญายังอยู่แต่จะหาผู้ให้เช่ารายนี้ไม่เจอ`
          : 'ลบแล้วเรียกคืนไม่ได้',
      confirmLabel: 'ลบ',
      destructive: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(landlord.id)
      toast.success('ลบผู้ให้เช่าแล้ว')
      navigate({ to: '/landlords' })
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
              <Link to='/landlords'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !landlord ? (
          <>
            <Button variant='ghost' size='sm' asChild className='self-start'>
              <Link to='/landlords'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบผู้ให้เช่า</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                ผู้ให้เช่า ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>{' '}
                ไม่มีในระบบ
              </CardContent>
            </Card>
          </>
        ) : (
          <Content
            landlord={landlord}
            contracts={contracts.data ?? []}
            banks={banks.data ?? []}
            onDelete={handleDelete}
            deleting={del.isPending}
          />
        )}
      </Main>
    </>
  )
}

function Content({
  landlord,
  contracts,
  banks,
  onDelete,
  deleting,
}: {
  landlord: NonNullable<ReturnType<typeof useLandlord>['data']>
  contracts: Array<{ id: string; data: Record<string, unknown> }>
  banks: NonNullable<ReturnType<typeof useBankAccountsByOwner>['data']>
  onDelete: () => Promise<void>
  deleting: boolean
}) {
  const t = landlord.data
  const isCompany = t.partyType === 'company'
  const Icon = isCompany ? Building2 : UserRound
  const addr = getLandlordAddrShort(t)

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <Button variant='ghost' size='icon' asChild className='mt-0.5'>
            <Link to='/landlords' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          {t.logo ? (
            <img
              src={t.logo}
              alt='โลโก้'
              className='size-14 shrink-0 rounded-md border bg-card object-contain'
            />
          ) : null}
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              {!t.logo && (
                <Icon className='size-5 text-muted-foreground' />
              )}
              <h1 className='text-2xl font-semibold tracking-tight'>
                {getLandlordName(t)}
              </h1>
              <Badge variant='secondary' className='font-normal'>
                {getPartyLabel(t.partyType)}
              </Badge>
              {t.vatRegistered && (
                <Badge variant='outline' className='font-normal'>
                  <Percent className='mr-1 size-3' />
                  จด VAT {t.vatRate ?? 7}%
                </Badge>
              )}
            </div>
            {t.shortName && t.shortName !== t.name && (
              <p className='mt-1 text-sm text-muted-foreground'>
                ชื่อย่อ: {t.shortName}
              </p>
            )}
            <p className='mt-1 text-sm text-muted-foreground'>
              ID:{' '}
              <code className='rounded bg-muted px-1.5 py-0.5'>
                {landlord.id}
              </code>
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={onDelete} disabled={deleting}>
            <Trash2 className='size-4' />
            ลบ
          </Button>
          <Button asChild>
            <Link to='/landlords/$id/edit' params={{ id: landlord.id }}>
              <Pencil className='size-4' />
              แก้ไข
            </Link>
          </Button>
        </div>
      </header>

      <div className='grid gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลผู้ให้เช่า</CardTitle>
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
                <InfoRow
                  icon={UserRound}
                  label='ชื่อกรรมการ'
                  value={t.signerName}
                />
                <InfoRow
                  icon={UserRound}
                  label='ตำแหน่ง'
                  value={t.signerTitle}
                />
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
              <span className='font-medium'>
                {formatDate(landlord.created_at)}
              </span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>แก้ไขล่าสุด</span>
              <span className='font-medium'>
                {formatDate(landlord.updated_at)}
              </span>
            </div>
            {t.invoiceHeaderId && (
              <div className='flex justify-between gap-3'>
                <span className='text-muted-foreground'>v1 invoice header</span>
                <span className='font-mono text-xs'>{t.invoiceHeaderId}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
            <CardTitle className='text-base'>
              <Landmark className='-mt-0.5 mr-1 inline size-4' />
              บัญชีธนาคาร ({banks.length})
            </CardTitle>
            <Button asChild variant='outline' size='sm'>
              <Link to='/bank-accounts/new' search={{ owner: landlord.id }}>
                <Plus className='size-3' />
                เพิ่มบัญชี
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {banks.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                ยังไม่มีบัญชีธนาคารผูกกับผู้ให้เช่ารายนี้ · กด "เพิ่มบัญชี" เพื่อเริ่ม
              </p>
            ) : (
              <ul className='divide-y'>
                {banks.map((ba) => {
                  const b = ba.data
                  const active = b.active !== false
                  return (
                    <li
                      key={ba.id}
                      className='grid gap-2 py-3 sm:grid-cols-[1fr_180px_1fr_auto] sm:items-center sm:gap-4'
                    >
                      <div>
                        <p className='text-xs text-muted-foreground'>ธนาคาร</p>
                        <Link
                          to='/bank-accounts/$id'
                          params={{ id: ba.id }}
                          className='text-sm font-medium hover:underline'
                        >
                          {b.bank || '—'}
                        </Link>
                      </div>
                      <div>
                        <p className='text-xs text-muted-foreground'>เลขบัญชี</p>
                        <p className='font-mono text-sm'>{b.acctNo || '—'}</p>
                      </div>
                      <div>
                        <p className='text-xs text-muted-foreground'>ชื่อบัญชี</p>
                        <p className='text-sm'>{b.accountName || '—'}</p>
                      </div>
                      <div className='flex gap-1'>
                        {b.label && (
                          <Badge variant='outline' className='font-normal'>
                            {b.label}
                          </Badge>
                        )}
                        {!active && (
                          <Badge variant='outline' className='font-normal text-muted-foreground'>
                            ปิด
                          </Badge>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {(t.promptPayId || t.promptPayBank || t.promptPayName) && (
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle className='text-base'>
                <QrCode className='-mt-0.5 mr-1 inline size-4' />
                PromptPay
              </CardTitle>
            </CardHeader>
            <CardContent className='grid gap-5 sm:grid-cols-3'>
              <InfoRow
                icon={CreditCard}
                label='เลข PromptPay'
                value={t.promptPayId}
              />
              <InfoRow
                icon={Landmark}
                label='ธนาคาร'
                value={t.promptPayBank}
              />
              <InfoRow
                icon={UserRound}
                label='ชื่อผู้รับ'
                value={t.promptPayName}
              />
            </CardContent>
          </Card>
        )}

        <Card className='lg:col-span-3'>
          <CardHeader>
            <CardTitle className='text-base'>
              สัญญาเช่าที่เกี่ยวข้อง ({contracts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                ผู้ให้เช่ารายนี้ยังไม่มีสัญญา
              </p>
            ) : (
              <ul className='divide-y'>
                {contracts.map((c) => {
                  const cd = c.data as {
                    no?: string
                    property?: string
                    tenant?: string
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
                        <p className='font-medium'>{cd.no ?? `#${c.id}`}</p>
                        <p className='truncate text-xs text-muted-foreground'>
                          {cd.tenant ?? '—'} · {cd.property ?? '—'} ·{' '}
                          {cd.start ?? '—'} → {cd.end ?? '—'}
                        </p>
                      </div>
                      {cd.status && (
                        <Badge
                          variant='outline'
                          className='shrink-0 font-normal'
                        >
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

        {t.notes && (
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle className='text-base'>หมายเหตุภายใน</CardTitle>
            </CardHeader>
            <CardContent className='whitespace-pre-wrap text-sm text-muted-foreground'>
              {t.notes}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
