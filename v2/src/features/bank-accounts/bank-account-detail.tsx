import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CreditCard,
  Landmark,
  Pencil,
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
import { useBankAccount } from '@/features/bank-accounts/queries'
import { useDeleteBankAccount } from '@/features/bank-accounts/mutations'

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

export function BankAccountDetail({ id }: { id: string }) {
  const { data: ba, isLoading, error } = useBankAccount(id)
  const del = useDeleteBankAccount()
  const confirm = useConfirm()
  const navigate = useNavigate()

  async function handleDelete() {
    if (!ba) return
    const ok = await confirm({
      title: `ลบบัญชี "${ba.data?.bank} · ${ba.data?.acctNo}"?`,
      description: 'ลบแล้วเรียกคืนไม่ได้ · ถ้ามี contract ผูกอยู่ contract นั้นจะหาบัญชีไม่เจอ',
      confirmLabel: 'ลบ',
      destructive: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(ba.id)
      toast.success('ลบบัญชีแล้ว')
      navigate({ to: '/bank-accounts' })
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
              <Link to='/bank-accounts'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !ba ? (
          <>
            <Button variant='ghost' size='sm' asChild className='self-start'>
              <Link to='/bank-accounts'>
                <ArrowLeft className='size-4' />
                กลับ
              </Link>
            </Button>
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบบัญชี</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                บัญชี ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>{' '}
                ไม่มีในระบบ
              </CardContent>
            </Card>
          </>
        ) : (
          <Content
            id={ba.id}
            data={ba.data}
            createdAt={ba.created_at}
            updatedAt={ba.updated_at}
            onDelete={handleDelete}
            deleting={del.isPending}
          />
        )}
      </Main>
    </>
  )
}

function Content({
  id,
  data,
  createdAt,
  updatedAt,
  onDelete,
  deleting,
}: {
  id: string
  data: NonNullable<ReturnType<typeof useBankAccount>['data']>['data']
  createdAt: string | null
  updatedAt: string | null
  onDelete: () => Promise<void>
  deleting: boolean
}) {
  const active = data.active !== false

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <Button variant='ghost' size='icon' asChild className='mt-0.5'>
            <Link to='/bank-accounts' aria-label='กลับ'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <Landmark className='size-5 text-muted-foreground' />
              <h1 className='text-2xl font-semibold tracking-tight'>
                {data.bank || '(ไม่มีชื่อธนาคาร)'}
              </h1>
              <Badge
                variant={active ? 'default' : 'outline'}
                className='font-normal'
              >
                {active ? 'เปิด' : 'ปิด'}
              </Badge>
              {data.label && (
                <Badge variant='secondary' className='font-normal'>
                  {data.label}
                </Badge>
              )}
            </div>
            <p className='mt-1 font-mono text-lg'>{data.acctNo}</p>
            <p className='mt-1 text-sm text-muted-foreground'>
              ID:{' '}
              <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={onDelete} disabled={deleting}>
            <Trash2 className='size-4' />
            ลบ
          </Button>
          <Button asChild>
            <Link to='/bank-accounts/$id/edit' params={{ id }}>
              <Pencil className='size-4' />
              แก้ไข
            </Link>
          </Button>
        </div>
      </header>

      <div className='grid gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลบัญชี</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-5 sm:grid-cols-2'>
            <InfoRow icon={Landmark} label='ธนาคาร + สาขา' value={data.bank} />
            <InfoRow icon={CreditCard} label='เลขบัญชี' value={data.acctNo} />
            <InfoRow icon={UserRound} label='ชื่อบัญชี' value={data.accountName} />
            <InfoRow icon={Landmark} label='ป้ายกำกับ' value={data.label} />
            <InfoRow
              icon={UserRound}
              label='เจ้าของบัญชี'
              value={data.ownerLandlordName}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลระบบ</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>รหัส (pid)</span>
              <span className='font-medium'>{data.pid ?? '—'}</span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>เพิ่มเมื่อ</span>
              <span className='font-medium'>{formatDate(createdAt)}</span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>แก้ไขล่าสุด</span>
              <span className='font-medium'>{formatDate(updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        {data.notes && (
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle className='text-base'>หมายเหตุภายใน</CardTitle>
            </CardHeader>
            <CardContent className='whitespace-pre-wrap text-sm text-muted-foreground'>
              {data.notes}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
