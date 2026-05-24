import { useNavigate  } from '@tanstack/react-router'
import {
  Calendar,
  FileText,
  Gauge,
  Pencil,
  Trash2,
  Zap,
  Droplets,
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
import { useConfirm } from '@/hooks/use-confirm'
import { getMeterTypeLabel, useMeterReading } from '@/features/meters/queries'
import {
  useDeleteMeterReading,
  useUpdateMeterReading,
} from '@/features/meters/mutations'
import {
  METER_READING_FORM_DEFAULTS,
  type MeterReadingFormValues,
} from '@/features/meters/schema'
import { MeterForm } from '@/features/meters/meter-form'
import type { MeterReadingData } from '@/features/meters/types'
import { BackButton } from '@/components/yonghua/back-button'

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
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | undefined
  mono?: boolean
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
        <p className={mono ? 'font-mono text-sm' : 'text-sm'}>
          {value?.trim() || '—'}
        </p>
      </div>
    </div>
  )
}

function MeterTypeIcon({ type }: { type: string | undefined }) {
  if (type === 'water') return <Droplets className='size-5' />
  if (type === 'electricity') return <Zap className='size-5' />
  return <Gauge className='size-5' />
}

export function MeterDetail({ id }: { id: string }) {
  const { data: reading, isLoading, error } = useMeterReading(id)
  const del = useDeleteMeterReading()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  async function handleDelete() {
    if (!reading) return
    const d = reading.data
    const ok = await confirm({
      title: `ลบรายการมิเตอร์ ${getMeterTypeLabel(d?.type)} · ${d?.property_name}?`,
      description: 'ลบแล้วเรียกคืนไม่ได้',
      confirmLabel: 'ลบ',
      destructive: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(reading.id)
      toast.success('ลบรายการมิเตอร์แล้ว')
      navigate({ to: '/meters' })
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
            <BackButton fallback='/meters' variant='text' />
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive'>
              โหลดข้อมูลไม่สำเร็จ —{' '}
              {error instanceof Error ? error.message : String(error)}
            </div>
          </>
        ) : !reading ? (
          <>
            <BackButton fallback='/meters' variant='text' />
            <Card>
              <CardHeader>
                <CardTitle>ไม่พบรายการมิเตอร์</CardTitle>
              </CardHeader>
              <CardContent className='text-sm text-muted-foreground'>
                ID{' '}
                <code className='rounded bg-muted px-1.5 py-0.5'>{id}</code>{' '}
                ไม่มีในระบบ
              </CardContent>
            </Card>
          </>
        ) : isEditing ? (
          <MeterEditing reading={reading} onDone={() => setIsEditing(false)} />
        ) : (
          <MeterContent
            data={reading.data}
            createdAt={reading.created_at}
            updatedAt={reading.updated_at}
            onDelete={handleDelete}
            deleting={del.isPending}
            onEdit={() => setIsEditing(true)}
          />
        )}
      </Main>
    </>
  )
}

function MeterEditing({
  reading,
  onDone,
}: {
  reading: NonNullable<ReturnType<typeof useMeterReading>['data']>
  onDone: () => void
}) {
  const update = useUpdateMeterReading(reading.id)
  const d = reading.data
  const defaults: MeterReadingFormValues = {
    ...METER_READING_FORM_DEFAULTS,
    property_id: d.property_id ?? '',
    property_name: d.property_name ?? '',
    contract_id: d.contract_id ?? '',
    type: d.type ?? 'electricity',
    meter_no: d.meter_no ?? '',
    reading_date: d.reading_date ?? '',
    prev_reading: d.prev_reading ?? 0,
    curr_reading: d.curr_reading ?? 0,
    rate_per_unit: d.rate_per_unit ?? 0,
    fixed_fee: d.fixed_fee ?? 0,
    notes: d.notes ?? '',
    billed: d.billed ?? false,
    invoice_id: d.invoice_id ?? '',
  }
  return (
    <>
      <header className='flex items-center gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight'>แก้ไขรายการมิเตอร์</h1>
        <p className='text-sm text-muted-foreground'>{d.property_name}</p>
      </header>
      <div className='max-w-3xl'>
        <MeterForm
          mode='edit'
          defaultValues={defaults}
          submitting={update.isPending}
          onCancel={onDone}
          onSubmit={async (values) => {
            await update.mutateAsync(values)
            toast.success('บันทึกการแก้ไขแล้ว')
            onDone()
          }}
        />
      </div>
    </>
  )
}

function MeterContent({
  data,
  createdAt,
  updatedAt,
  onDelete,
  deleting,
  onEdit,
}: {
  data: MeterReadingData
  createdAt: string | null
  updatedAt: string | null
  onDelete: () => Promise<void>
  deleting: boolean
  onEdit: () => void
}) {
  const billed = data.billed ?? false

  return (
    <>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex items-start gap-3'>
          <BackButton fallback='/meters' />
          <div className='mt-0.5 text-muted-foreground'>
            <MeterTypeIcon type={data.type} />
          </div>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-semibold tracking-tight'>
                {data.property_name || '(ไม่มีชื่อ)'}
              </h1>
              <Badge variant='outline' className='font-normal'>
                {getMeterTypeLabel(data.type)}
              </Badge>
              <Badge variant={billed ? 'default' : 'secondary'} className='font-normal'>
                {billed ? 'เรียกเก็บแล้ว' : 'ยังไม่เก็บ'}
              </Badge>
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>
              วันที่อ่าน: {data.reading_date || '—'}
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='ghost'
            onClick={onDelete}
            disabled={deleting}
            className='text-destructive hover:bg-destructive/10 hover:text-destructive'
          >
            <Trash2 className='size-4' />
            ลบ
          </Button>
          <Button onClick={onEdit}>
            <Pencil className='size-4' />
            แก้ไข
          </Button>
        </div>
      </header>

      <div className='grid gap-6 lg:grid-cols-3'>
        {/* รายละเอียดมิเตอร์ */}
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลการอ่านมิเตอร์</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-5 sm:grid-cols-2'>
            <InfoRow icon={Calendar} label='วันที่อ่าน' value={data.reading_date} />
            <InfoRow
              icon={Gauge}
              label='หมายเลขมิเตอร์'
              value={data.meter_no}
              mono
            />
            <InfoRow
              icon={Gauge}
              label='ค่ามิเตอร์ก่อนหน้า'
              value={(data.prev_reading ?? 0).toLocaleString('th-TH')}
            />
            <InfoRow
              icon={Gauge}
              label='ค่ามิเตอร์ปัจจุบัน'
              value={(data.curr_reading ?? 0).toLocaleString('th-TH')}
            />
            <InfoRow
              icon={Gauge}
              label='หน่วยที่ใช้'
              value={`${(data.units ?? 0).toLocaleString('th-TH')} หน่วย`}
            />
            <InfoRow
              icon={Gauge}
              label='ราคาต่อหน่วย'
              value={`${(data.rate_per_unit ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
            />
            {(data.fixed_fee ?? 0) > 0 && (
              <InfoRow
                icon={Gauge}
                label='ค่าบริการคงที่'
                value={`${(data.fixed_fee ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
              />
            )}
            <InfoRow
              icon={Gauge}
              label='ยอดรวม'
              value={`${(data.total ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
            />
            {data.contract_id && (
              <InfoRow icon={FileText} label='สัญญา' value={data.contract_id} />
            )}
          </CardContent>
        </Card>

        {/* ข้อมูลระบบ */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>ข้อมูลระบบ</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>เพิ่มเมื่อ</span>
              <span className='font-medium'>{formatDate(createdAt)}</span>
            </div>
            <div className='flex justify-between gap-3'>
              <span className='text-muted-foreground'>แก้ไขล่าสุด</span>
              <span className='font-medium'>{formatDate(updatedAt)}</span>
            </div>
            {billed && data.invoice_id && (
              <div className='flex justify-between gap-3'>
                <span className='text-muted-foreground'>ใบแจ้งหนี้</span>
                <span className='font-medium font-mono text-xs'>{data.invoice_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* หมายเหตุ */}
        {data.notes && (
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle className='text-base'>หมายเหตุ</CardTitle>
            </CardHeader>
            <CardContent className='whitespace-pre-wrap text-sm text-muted-foreground'>
              {data.notes}
            </CardContent>
          </Card>
        )}

        {/* สร้างใบแจ้งหนี้ — แสดงเฉพาะตอนยังไม่เก็บ */}
        {!billed && (
          <Card className='lg:col-span-3 border-dashed border-primary/30 bg-primary/5'>
            <CardHeader>
              <CardTitle className='text-base'>สร้างใบแจ้งหนี้</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <p className='text-muted-foreground'>
                รายการนี้ยังไม่ได้เรียกเก็บ — ใช้ข้อมูลด้านล่างเพิ่มในใบแจ้งหนี้:
              </p>
              <div className='rounded-md border bg-background p-4 space-y-1 font-mono text-xs'>
                <p>รายการ: ค่า{getMeterTypeLabel(data.type)} ({data.reading_date})</p>
                <p>
                  หน่วย: {(data.prev_reading ?? 0).toLocaleString('th-TH')} →{' '}
                  {(data.curr_reading ?? 0).toLocaleString('th-TH')} ={' '}
                  {(data.units ?? 0).toLocaleString('th-TH')} หน่วย
                </p>
                <p>
                  อัตรา: {(data.rate_per_unit ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท/หน่วย
                  {(data.fixed_fee ?? 0) > 0 &&
                    ` + ค่าบริการ ${(data.fixed_fee ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
                </p>
                <p className='font-bold text-sm pt-1'>
                  ยอดรวม: {(data.total ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </p>
              </div>
              <p className='text-xs text-muted-foreground'>
                หลังเพิ่มในใบแจ้งหนี้แล้ว ให้กด "แก้ไข" เพื่อทำเครื่องหมาย "เรียกเก็บแล้ว"
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
