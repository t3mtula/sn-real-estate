/**
 * Batch receipt print — พิมพ์ใบเสร็จหลายใบในเอกสารเดียว
 *
 * Port of v1 batchPrintReceipts() + batchReceiptHTML()
 *
 * ใช้ข้อมูล snapshot ใน invoice.data (tenant / property / landlord)
 * → ไม่ต้องเรียก DB เพิ่ม
 * → เปิด popup window แล้ว print ทันที
 */
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import { amt, fmtBE } from '@/lib/thai'
import { Button } from '@/components/ui/button'
import type { Invoice, InvoicePayment } from './types'

// ── HTML builder (pure function — no React) ──────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  )
}

function fmtBaht(n: unknown): string {
  const num = Number(n) || 0
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildSingleReceiptHtml(inv: Invoice, today: string): string {
  const d = inv.data
  const payments: InvoicePayment[] = d?.payments ?? []
  const lastPayment = payments[payments.length - 1]
  const paidDate = lastPayment?.date ?? d?.paidAt ?? today
  const receiptNo = (d?.receiptNo as string | undefined) ??
    (d?.invoiceNo ? d.invoiceNo.replace('INV', 'REC') : inv.id)
  const taxInvoiceNo = (d?.taxInvoiceNo as string | undefined) ?? ''
  const isVat = d?.vatMode && d.vatMode !== 'none'
  const docTitle = isVat ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี' : 'ใบเสร็จรับเงิน'

  const itemsHtml = (d?.items ?? [])
    .map(
      (it, i) =>
        `<tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:4px 6px">${i + 1}. ${esc(it.desc)}</td>
          <td style="padding:4px 6px;text-align:right;font-variant-numeric:tabular-nums">${fmtBaht(it.amount)}</td>
        </tr>`,
    )
    .join('')

  const paymentsHtml = payments
    .map(
      (p) =>
        `<div style="display:flex;justify-content:space-between;color:#16a34a">
          <span>รับเงิน ${esc(p.date ?? '')}</span>
          <span style="font-weight:600">+${fmtBaht(p.amount)}</span>
        </div>`,
    )
    .join('')

  function halfHtml(copyLabel: 'ต้นฉบับ' | 'สำเนา'): string {
    return `
    <div style="padding:12mm 14mm;border-bottom:1px dashed #cbd5e1;position:relative;font-family:Sarabun,sans-serif;font-size:12px;line-height:1.6">
      ${copyLabel === 'สำเนา' ? '<div style="position:absolute;top:10mm;right:14mm;font-size:28px;font-weight:800;color:rgba(100,116,139,0.15);transform:rotate(-20deg);user-select:none">สำเนา</div>' : ''}
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-size:16px;font-weight:700;color:#059669">${esc(docTitle)}</div>
          <div style="font-size:9px;color:#94a3b8;letter-spacing:0.1em">RECEIPT · ${esc(copyLabel)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;color:#94a3b8">เลขที่ใบเสร็จ</div>
          <div style="font-weight:600">${esc(receiptNo)}</div>
          ${taxInvoiceNo ? `<div style="font-size:9px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 6px;margin-top:2px">เลขใบกำกับภาษี ${esc(taxInvoiceNo)}</div>` : ''}
          <div style="font-size:10px;color:#475569;margin-top:2px">วันที่ ${esc(paidDate)}</div>
        </div>
      </div>
      <!-- Parties -->
      <div style="background:#f8fafc;border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:11px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div>
            <div style="color:#94a3b8;font-size:9px">ผู้ให้เช่า</div>
            <div style="font-weight:600">${esc(d?.landlord ?? '')}</div>
          </div>
          <div>
            <div style="color:#94a3b8;font-size:9px">ผู้เช่า</div>
            <div style="font-weight:600">${esc(d?.tenant ?? '')}</div>
          </div>
          <div style="grid-column:1/-1">
            <div style="color:#94a3b8;font-size:9px">ทรัพย์สิน</div>
            <div style="font-weight:600">${esc(d?.property ?? '')}</div>
          </div>
        </div>
      </div>
      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="text-align:left;padding:4px 6px;font-weight:600">รายการ</th>
            <th style="text-align:right;padding:4px 6px;font-weight:600">ยอด</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <!-- Totals -->
      <div style="border-top:1px solid #e2e8f0;padding-top:6px;font-size:11px;display:flex;flex-direction:column;gap:2px">
        <div style="display:flex;justify-content:space-between">
          <span style="color:#64748b">ยอดรวม</span>
          <span style="font-weight:600">${fmtBaht(d?.total)}</span>
        </div>
        ${paymentsHtml}
      </div>
      <!-- Signature -->
      <div style="margin-top:12px;display:flex;justify-content:flex-end">
        <div style="text-align:center;width:120px">
          <div style="border-bottom:1px solid #cbd5e1;height:28px"></div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">ผู้รับเงิน</div>
        </div>
      </div>
    </div>`
  }

  return halfHtml('ต้นฉบับ') + halfHtml('สำเนา')
}

function buildBatchReceiptHtml(invoices: Invoice[]): string {
  const today = fmtBE(new Date())
  const pages = invoices
    .map(
      (inv) =>
        `<div class="receipt-page">${buildSingleReceiptHtml(inv, today)}</div>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ใบเสร็จรับเงิน รวม ${invoices.length} ใบ</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; background: #f8fafc; }
  .receipt-page {
    max-width: 148mm;
    margin: 8mm auto;
    background: white;
    box-shadow: 0 1px 4px rgba(0,0,0,.1);
    border-radius: 4px;
    overflow: hidden;
  }
  @media print {
    body { background: white; }
    .receipt-page {
      max-width: none;
      margin: 0;
      box-shadow: none;
      border-radius: 0;
      page-break-after: always;
    }
    .receipt-page:last-child { page-break-after: avoid; }
  }
  @page { size: A5 portrait; margin: 0; }
</style>
</head>
<body>
${pages}
<script>
  window.onload = function() {
    // Small delay to let Google Fonts load
    setTimeout(function() { window.print() }, 400)
  }
<\/script>
</body>
</html>`
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  invoices: Invoice[]
  /** Pass only paid invoices — will filter internally as safety net */
  disabled?: boolean
}

export function BatchReceiptPrintButton({ invoices, disabled }: Props) {
  const paidInvoices = invoices.filter((inv) => {
    const s = (inv.status ?? inv.data?.status ?? '').toLowerCase()
    return s === 'paid' || (inv.data?.remainingAmount ?? 1) === 0
  })

  function handlePrint() {
    if (paidInvoices.length === 0) {
      toast.warning('ไม่มีใบเสร็จที่พิมพ์ได้ · เลือกเฉพาะใบที่ชำระแล้ว')
      return
    }
    const html = buildBatchReceiptHtml(paidInvoices)
    const win = window.open('', '_blank', 'width=700,height=900')
    if (!win) {
      toast.error('ไม่สามารถเปิดหน้าต่างพิมพ์ · กรุณาอนุญาต popup')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  return (
    <Button
      size='sm'
      variant='outline'
      disabled={disabled || paidInvoices.length === 0}
      onClick={handlePrint}
      title={`พิมพ์ใบเสร็จ ${paidInvoices.length} ใบ`}
    >
      <Printer className='size-4' />
      ใบเสร็จ
      {paidInvoices.length > 0 && ` (${paidInvoices.length})`}
    </Button>
  )
}

// Also export a summary row for the print (used in receipt list)
export function receiptSummaryAmt(invoices: Invoice[]): number {
  return invoices.reduce((s, inv) => s + (Number(inv.data?.total) || 0), 0)
}

export { buildBatchReceiptHtml }
