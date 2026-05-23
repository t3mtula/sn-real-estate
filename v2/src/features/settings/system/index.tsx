import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { useSystemSettings } from '../queries'
import { useSaveSystemSettings } from '../mutations'
import type { SystemSettings as SystemSettingsType } from '../queries'

const APP_VERSION = 'v2.1.0'

const DEFAULT_FORM: SystemSettingsType = {
  contractPrefix: 'SN',
  invoicePrefix: 'INV',
  receiptPrefix: 'REC',
  expiryWarningDays: 90,
  overdueWarningDays: 7,
  lineNotifyToken: '',
  slipOkBranchId: '',
  slipOkApiKey: '',
}

type CheckResult = {
  label: string
  count: number
}

export function SystemSettings() {
  const { data, isLoading } = useSystemSettings()
  const save = useSaveSystemSettings()
  const [form, setForm] = useState<SystemSettingsType>(DEFAULT_FORM)

  const [exporting, setExporting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null)

  useEffect(() => {
    if (data) setForm({ ...DEFAULT_FORM, ...data })
  }, [data])

  function set<K extends keyof SystemSettingsType>(k: K, v: SystemSettingsType[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSave() {
    save.mutate(form, {
      onSuccess: () => toast.success('บันทึกการตั้งค่าระบบแล้ว'),
      onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
    })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const tables = [
        'contracts',
        'invoices',
        'properties',
        'tenants',
        'landlords',
        'bank_accounts',
        'app_settings',
      ]
      const result: Record<string, unknown[]> = {}
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*')
        if (error) throw new Error(`${table}: ${error.message}`)
        result[table] = data ?? []
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      a.download = `sn-realestate-export-${dateStr}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export เสร็จแล้ว')
    } catch (e) {
      toast.error('Export ไม่สำเร็จ', { description: String(e) })
    } finally {
      setExporting(false)
    }
  }

  async function handleCheck() {
    setChecking(true)
    setCheckResults(null)
    try {
      const { count: noProperty } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .is('data->>pid_property', null)

      const { count: noTenant } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .is('data->>tenant_id', null)

      const { data: invoices } = await supabase
        .from('invoices')
        .select('data->>contract_id')
      const contractIds = new Set<string>()
      const { data: allContracts } = await supabase
        .from('contracts')
        .select('id')
      for (const c of allContracts ?? []) contractIds.add(c.id)
      const noContract = (invoices ?? []).filter((inv) => {
        const cid = (inv as { 'data->>contract_id'?: string })['data->>contract_id']
        return !cid || !contractIds.has(cid)
      }).length

      setCheckResults([
        { label: 'สัญญาที่ไม่ระบุทรัพย์สิน', count: noProperty ?? 0 },
        { label: 'สัญญาที่ไม่ระบุผู้เช่า', count: noTenant ?? 0 },
        { label: 'ใบแจ้งหนี้ที่ไม่มีสัญญาอ้างอิง', count: noContract },
      ])
    } catch (e) {
      toast.error('ตรวจสอบไม่สำเร็จ', { description: String(e) })
    } finally {
      setChecking(false)
    }
  }

  const allOk = checkResults?.every((r) => r.count === 0)

  if (isLoading) return <p className='text-sm text-muted-foreground'>กำลังโหลด…</p>

  return (
    <div className='space-y-6 w-full max-w-2xl'>
      <div>
        <h3 className='text-lg font-medium'>การตั้งค่าทั่วไป</h3>
        <p className='text-sm text-muted-foreground'>
          รูปแบบเลขเอกสาร · เกณฑ์แจ้งเตือน · API ภายนอก · เครื่องมือดูแลระบบ
        </p>
      </div>
      <Separator />

      {/* รูปแบบเลขเอกสาร */}
      <section className='space-y-3'>
        <h4 className='font-medium'>รูปแบบเลขเอกสาร</h4>
        <p className='text-xs text-muted-foreground'>
          คำนำหน้าที่ใช้สร้างเลขเอกสารอัตโนมัติ — ระบบจะเติม ปี/เดือน/ลำดับ ให้เอง
        </p>
        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='space-y-1'>
            <Label htmlFor='sys-contract-prefix'>สัญญา</Label>
            <Input
              id='sys-contract-prefix'
              value={form.contractPrefix ?? ''}
              onChange={(e) => set('contractPrefix', e.target.value)}
              placeholder='SN'
            />
            <p className='text-xs text-muted-foreground'>เช่น {(form.contractPrefix || 'SN')}.01-0001</p>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='sys-invoice-prefix'>ใบแจ้งหนี้</Label>
            <Input
              id='sys-invoice-prefix'
              value={form.invoicePrefix ?? ''}
              onChange={(e) => set('invoicePrefix', e.target.value)}
              placeholder='INV'
            />
            <p className='text-xs text-muted-foreground'>เช่น {(form.invoicePrefix || 'INV')}-2026-05-0001</p>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='sys-receipt-prefix'>ใบเสร็จ</Label>
            <Input
              id='sys-receipt-prefix'
              value={form.receiptPrefix ?? ''}
              onChange={(e) => set('receiptPrefix', e.target.value)}
              placeholder='REC'
            />
            <p className='text-xs text-muted-foreground'>เช่น {(form.receiptPrefix || 'REC')}-2026-05-0001</p>
          </div>
        </div>
      </section>

      <Separator />

      {/* เกณฑ์แจ้งเตือน */}
      <section className='space-y-3'>
        <h4 className='font-medium'>เกณฑ์การแจ้งเตือน</h4>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label htmlFor='sys-exp-days'>แจ้งเตือนสัญญาใกล้หมด (วันก่อน)</Label>
            <Input
              id='sys-exp-days'
              type='number'
              min={1}
              max={365}
              value={form.expiryWarningDays ?? 90}
              onChange={(e) => set('expiryWarningDays', Number(e.target.value))}
            />
            <p className='text-xs text-muted-foreground'>แสดงใน Dashboard และหน้าสัญญาใกล้หมด</p>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='sys-ov-days'>แจ้งเตือนใบแจ้งหนี้เกินกำหนด (วัน)</Label>
            <Input
              id='sys-ov-days'
              type='number'
              min={0}
              max={90}
              value={form.overdueWarningDays ?? 7}
              onChange={(e) => set('overdueWarningDays', Number(e.target.value))}
            />
            <p className='text-xs text-muted-foreground'>0 = แจ้งทันทีที่เกินกำหนด</p>
          </div>
        </div>
      </section>

      <Separator />

      {/* LINE Notify */}
      <section className='space-y-3'>
        <h4 className='font-medium'>LINE Notify (แจ้งเตือนอัตโนมัติ)</h4>
        <p className='text-xs text-muted-foreground'>
          ใส่ Token จาก notify-bot.line.me เพื่อส่งแจ้งเตือนเข้ากลุ่ม LINE
        </p>
        <div className='space-y-1'>
          <Label htmlFor='sys-line-token'>LINE Notify Token</Label>
          <Input
            id='sys-line-token'
            type='password'
            value={form.lineNotifyToken ?? ''}
            onChange={(e) => set('lineNotifyToken', e.target.value)}
            placeholder='xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
          />
        </div>
      </section>

      <Separator />

      {/* SlipOK */}
      <section className='space-y-3'>
        <h4 className='font-medium'>SlipOK (ตรวจสลิปอัตโนมัติ)</h4>
        <p className='text-xs text-muted-foreground'>
          ใส่ข้อมูลจาก slipok.com เพื่อเปิดใช้การตรวจสลิปอัตโนมัติ
        </p>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label htmlFor='sys-slipok-branch'>Branch ID</Label>
            <Input
              id='sys-slipok-branch'
              value={form.slipOkBranchId ?? ''}
              onChange={(e) => set('slipOkBranchId', e.target.value)}
              placeholder='BXXXXXXX'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='sys-slipok-key'>API Key</Label>
            <Input
              id='sys-slipok-key'
              type='password'
              value={form.slipOkApiKey ?? ''}
              onChange={(e) => set('slipOkApiKey', e.target.value)}
              placeholder='sk_...'
            />
          </div>
        </div>
      </section>

      <div className='flex justify-end'>
        <Button onClick={handleSave} disabled={save.isPending}>
          บันทึก
        </Button>
      </div>

      <Separator />

      {/* ข้อมูลแอป */}
      <section className='space-y-3'>
        <h4 className='font-medium'>ข้อมูลแอป</h4>
        <div className='rounded-md border bg-muted/40 p-4 space-y-2 text-sm'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>เวอร์ชัน</span>
            <span className='font-mono font-medium'>{APP_VERSION}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>ฐานข้อมูล</span>
            <span className='text-green-600 font-medium'>Supabase (เชื่อมต่อแล้ว)</span>
          </div>
        </div>
      </section>

      <Separator />

      {/* Export ข้อมูล */}
      <section className='space-y-3'>
        <h4 className='font-medium'>Export ข้อมูล</h4>
        <p className='text-sm text-muted-foreground'>
          ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON — สัญญา ใบแจ้งหนี้ ทรัพย์สิน ผู้เช่า ผู้ให้เช่า บัญชีรับโอน
        </p>
        <Button onClick={handleExport} disabled={exporting} variant='outline'>
          {exporting ? 'กำลัง Export…' : 'Export ทั้งหมด (.json)'}
        </Button>
      </section>

      <Separator />

      {/* ตรวจสอบข้อมูล */}
      <section className='space-y-3'>
        <h4 className='font-medium'>ตรวจสอบความสมบูรณ์ของข้อมูล</h4>
        <p className='text-sm text-muted-foreground'>
          ตรวจหาข้อมูลที่อาจมีปัญหา เช่น สัญญาที่ขาดข้อมูลสำคัญ
        </p>
        <Button onClick={handleCheck} disabled={checking} variant='outline'>
          {checking ? 'กำลังตรวจสอบ…' : 'ตรวจสอบ'}
        </Button>

        {checkResults && (
          <div className='rounded-md border p-4 space-y-3 text-sm'>
            {allOk ? (
              <p className='text-green-600 font-medium'>ข้อมูลสมบูรณ์ ไม่พบปัญหา</p>
            ) : (
              <>
                <p className='text-amber-600 font-medium'>พบรายการที่ควรตรวจสอบ:</p>
                <ul className='space-y-1.5'>
                  {checkResults
                    .filter((r) => r.count > 0)
                    .map((r) => (
                      <li key={r.label} className='flex justify-between'>
                        <span className='text-muted-foreground'>{r.label}</span>
                        <span className='font-medium text-amber-600'>{r.count} รายการ</span>
                      </li>
                    ))}
                </ul>
              </>
            )}
            {!allOk && checkResults.filter((r) => r.count === 0).length > 0 && (
              <ul className='space-y-1'>
                {checkResults
                  .filter((r) => r.count === 0)
                  .map((r) => (
                    <li key={r.label} className='flex justify-between text-muted-foreground'>
                      <span>{r.label}</span>
                      <span className='text-green-600'>ปกติ</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
