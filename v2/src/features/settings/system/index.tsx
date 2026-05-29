import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useConfirm } from '@/hooks/use-confirm'
import { supabase } from '@/lib/supabase'

const APP_VERSION = 'v2.1.0'

type CheckResult = {
  label: string
  count: number
}

export function SystemSettings() {
  const [exporting, setExporting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null)

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
      // สัญญาที่ไม่มีทรัพย์สิน (pid_property is null)
      const { count: noProperty } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .is('data->>pid_property', null)

      // สัญญาที่ไม่มีผู้เช่า (tenant_id is null)
      const { count: noTenant } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .is('data->>tenant_id', null)

      // ใบแจ้งหนี้ที่ไม่มีสัญญา
      const { data: invoices } = await supabase
        .from('invoices')
        .select('data->>contract_id')
      const contractIds = new Set<string>()
      const { data: allContracts } = await supabase
        .from('contracts')
        .select('id')
      for (const c of allContracts ?? []) contractIds.add(c.id)
      const noContract = (invoices ?? []).filter(
        (inv) => {
          const cid = (inv as { 'data->>contract_id'?: string })['data->>contract_id']
          return !cid || !contractIds.has(cid)
        }
      ).length

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

  const confirm = useConfirm()
  const [deletingInvoices, setDeletingInvoices] = useState(false)

  async function handleDeleteAllInvoices() {
    const ok = await confirm({
      title: 'ลบใบแจ้งหนี้ทั้งหมด?',
      description:
        'ข้อมูลใบแจ้งหนี้ทุกใบในระบบจะถูกลบถาวร · ไม่สามารถเรียกคืนได้ · ใช้เพื่อล้างข้อมูลทดสอบก่อนเริ่มใช้งานจริง',
      confirmLabel: 'ลบทั้งหมด',
      destructive: true,
    })
    if (!ok) return
    setDeletingInvoices(true)
    try {
      const { error } = await supabase.from('invoices').delete().neq('id', '')
      if (error) throw error
      toast.success('ลบใบแจ้งหนี้ทั้งหมดแล้ว')
    } catch (e) {
      toast.error('ลบไม่สำเร็จ', { description: String(e) })
    } finally {
      setDeletingInvoices(false)
    }
  }

  const allOk = checkResults?.every((r) => r.count === 0)

  return (
    <div className='space-y-6 w-full max-w-2xl'>
      <div>
        <h3 className='text-lg font-medium'>ระบบ</h3>
        <p className='text-sm text-muted-foreground'>ข้อมูลแอปและเครื่องมือดูแลระบบ</p>
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
              <p className='text-green-600 font-medium'>ข้อมูลสมบูรณ์ ✓ ไม่พบปัญหา</p>
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
                      <span className='text-green-600'>ปกติ ✓</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* จัดการข้อมูล */}
      <section className='space-y-3'>
        <h4 className='font-medium text-destructive'>โซนอันตราย</h4>
        <div className='rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3'>
          <div>
            <p className='text-sm font-medium'>ลบใบแจ้งหนี้ทั้งหมด</p>
            <p className='text-xs text-muted-foreground mt-0.5'>
              ใช้เพื่อล้างข้อมูลทดสอบก่อนเริ่มใช้งานจริง · ลบแล้วเรียกคืนไม่ได้
            </p>
          </div>
          <Button
            variant='destructive'
            size='sm'
            onClick={handleDeleteAllInvoices}
            disabled={deletingInvoices}
          >
            {deletingInvoices ? 'กำลังลบ…' : 'ลบใบแจ้งหนี้ทั้งหมด'}
          </Button>
        </div>
      </section>
    </div>
  )
}
