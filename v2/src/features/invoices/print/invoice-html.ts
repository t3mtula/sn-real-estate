/**
 * Build invoice / receipt print HTML — ported from v1 modules/19-invoices.js
 *
 * v1's invoiceHTML() + receiptHTML() rendered as TS string builders.
 * Output is loaded into an iframe via srcdoc; browser handles pagination
 * + window.print() via @media print CSS baked in.
 *
 * Both buildInvoiceHtml and buildReceiptHtml are async because they may
 * generate a PromptPay QR data URL via the `qrcode` package (already a
 * dependency, used by the PromptPayQR component).
 */

import type { BankAccount } from '@/features/bank-accounts/types'
import type { Contract } from '@/features/contracts/types'
import type { Invoice, InvoiceItem, InvoicePayment } from '@/features/invoices/types'
import type { Landlord } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'
import { buildPromptPayPayload } from '@/features/invoices/promptpay-qr'

export type InvoiceHtmlRefs = {
  invoice: Invoice
  contract?: Contract | null
  tenant?: Tenant | null
  landlord?: Landlord | null
  property?: Property | null
  bank?: BankAccount | null
}

const TH_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

const TH_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

const FREQ_LABELS: Record<string, string> = {
  monthly: 'รายเดือน',
  quarterly: 'รายไตรมาส',
  semi: 'ราย 6 เดือน',
  yearly: 'รายปี',
  lump: 'ครั้งเดียว',
}

function esc(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtBaht(n: number | undefined | null, dec = 2): string {
  if (n == null || !Number.isFinite(Number(n))) return '0.00'
  return Number(n).toLocaleString('th-TH', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function dateToBE(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`
}

function monthLabelBE(month: string): string {
  const [y, mm] = (month ?? '').split('-')
  const mi = Number.parseInt(mm ?? '0', 10) - 1
  const yr = Number.parseInt(y ?? '0', 10) + 543
  if (mi < 0 || mi > 11 || !Number.isFinite(yr)) return month
  return `${TH_MONTHS_FULL[mi]} ${yr}`
}

/** Enrich rent item description with billing-period text (ported from v1 enrichDesc). */
function enrichDesc(item: InvoiceItem, invoice: Invoice): string {
  const d = item.desc ?? ''
  if (/ประจำเดือน|ไตรมาสที่|ครึ่งปี\d|ประจำปี/.test(d)) return d
  if (!d.startsWith('ค่าเช่า')) return d
  const month = invoice.data?.month ?? ''
  const [y, mo] = month.split('-')
  const yearBE = Number.parseInt(y ?? '0', 10) + 543
  const mNum = Number.parseInt(mo ?? '0', 10)
  if (!yearBE || !mNum) return d
  const shortY = String(Number.parseInt(y ?? '0', 10)).slice(-2)
  const freq = invoice.data?.freqType ?? 'monthly'
  if (freq === 'monthly') return `ค่าเช่าประจำเดือน ${TH_MONTHS_FULL[mNum - 1]} ${yearBE}`
  if (freq === 'quarterly') {
    const q = Math.ceil(mNum / 3)
    return `ค่าเช่าไตรมาสที่ ${q} (${TH_MONTHS_SHORT[(q - 1) * 3]}-${TH_MONTHS_SHORT[Math.min(q * 3 - 1, 11)]} ${yearBE})`
  }
  if (freq === 'semi') {
    const h = mNum <= 6 ? 1 : 2
    return `ค่าเช่าครึ่งปี${h} (${h === 1 ? 'ม.ค.' : 'ก.ค.'}-${h === 1 ? 'มิ.ย.' : 'ธ.ค.'} ${yearBE})`
  }
  if (freq === 'yearly') return `ค่าเช่าประจำปี ${yearBE} (1 ม.ค. ${shortY} - 31 ธ.ค. ${shortY})`
  return d
}

/** VAT calculator — ported from v1 calcVat(inv, header). */
type VatResult = {
  isVat: boolean
  rate: number
  subtotal: number
  vatAmount: number
  total: number
}
function calcVat(invoice: Invoice, landlord: Landlord | null | undefined): VatResult {
  const inv = invoice.data ?? {}
  const items = inv.items ?? []
  const lr = landlord?.data
  // Per-line vatable structure (v1 new)
  if (items.some((it) => 'vatable' in (it as Record<string, unknown>))) {
    const rate = Number(inv.vatRate) || Number(lr?.vatRate) || 7
    const subVat = items
      .filter((it) => (it as InvoiceItem & { vatable?: boolean }).vatable)
      .reduce((s, it) => s + (Number(it.amount) || 0), 0)
    const subNoVat = items
      .filter((it) => !(it as InvoiceItem & { vatable?: boolean }).vatable)
      .reduce((s, it) => s + (Number(it.amount) || 0), 0)
    const vatAmount = (subVat * rate) / 100
    return {
      isVat: subVat > 0,
      rate,
      subtotal: +(subNoVat + subVat).toFixed(2),
      vatAmount: +vatAmount.toFixed(2),
      total: +(subNoVat + subVat + vatAmount).toFixed(2),
    }
  }
  // Legacy invoice-level vatMode
  let mode = (inv.vatMode as string) || ''
  if (!mode) {
    if (lr?.vatMode) mode = lr.vatMode as string
    else if (lr?.vatRegistered) mode = 'inclusive'
    else mode = 'none'
  }
  const rate = mode === 'none' ? 0 : Number(inv.vatRate) || Number(lr?.vatRate) || 7
  const total = Number(inv.total) || 0
  if (mode === 'none') return { isVat: false, rate, subtotal: total, vatAmount: 0, total }
  // exclusive + inclusive both treat the line total as gross (v1 hack)
  const subtotal = total / (1 + rate / 100)
  return {
    isVat: true,
    rate,
    subtotal: +subtotal.toFixed(2),
    vatAmount: +(total - subtotal).toFixed(2),
    total: +total.toFixed(2),
  }
}

async function generateQrDataUrl(
  promptPayId: string,
  amount: number,
  txId: string,
): Promise<string | null> {
  try {
    const payload = buildPromptPayPayload(promptPayId, amount, txId)
    const mod = await import('qrcode')
    return mod.toDataURL(payload, { margin: 1, width: 256 })
  } catch {
    return null
  }
}

function buildAddress(parts: {
  addrLine?: string
  addrSubdistrict?: string
  addrDistrict?: string
  addrProvince?: string
  addrPostal?: string
}): string {
  return [
    parts.addrLine,
    parts.addrSubdistrict && `ต.${parts.addrSubdistrict}`,
    parts.addrDistrict && `อ.${parts.addrDistrict}`,
    parts.addrProvince && `จ.${parts.addrProvince}`,
    parts.addrPostal,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function resolveLandlord(refs: InvoiceHtmlRefs) {
  const lr = refs.landlord?.data
  const c = refs.contract?.data
  const name = (lr?.name ?? c?.landlord ?? '').replace(/\s*โดย\s+.+$/, '')
  const addr =
    buildAddress({
      addrLine: lr?.addrLine,
      addrSubdistrict: lr?.addrSubdistrict,
      addrDistrict: lr?.addrDistrict,
      addrProvince: lr?.addrProvince,
      addrPostal: lr?.addrPostal,
    }) ||
    c?.landlordAddr ||
    ''
  return {
    name,
    address: addr,
    phone: lr?.phone ?? '',
    taxId: lr?.taxId ?? '',
    logo: (lr?.logo ?? '') as string,
    promptPayId: lr?.promptPayId ?? '',
    promptPayBank: lr?.promptPayBank ?? '',
    promptPayName: lr?.promptPayName ?? '',
  }
}

function resolveTenantAddr(refs: InvoiceHtmlRefs): string {
  const tr = refs.tenant?.data
  const c = refs.contract?.data
  return (
    buildAddress({
      addrLine: tr?.addrLine,
      addrSubdistrict: tr?.addrSubdistrict,
      addrDistrict: tr?.addrDistrict,
      addrProvince: tr?.addrProvince,
      addrPostal: tr?.addrPostal,
    }) ||
    c?.tenantAddr ||
    ''
  )
}

function resolveBank(refs: InvoiceHtmlRefs) {
  const b = refs.bank?.data
  return {
    bank: b?.bank ?? '',
    acctNo: b?.acctNo ?? '',
    accountName: b?.accountName ?? '',
  }
}

/* ─────────── Invoice HTML ─────────── */

export async function buildInvoiceHtml(refs: InvoiceHtmlRefs): Promise<string> {
  const inv = refs.invoice.data
  const c = refs.contract?.data
  const today = new Date()
  const todayBE = dateToBE(today)
  const landlord = resolveLandlord(refs)
  const tenantAddr = resolveTenantAddr(refs)
  const tenantTaxId = refs.tenant?.data?.taxId ?? c?.taxId ?? ''
  const bank = resolveBank(refs)

  const isDeposit = (refs.invoice.category ?? inv.category ?? 'rent') === 'deposit'
  const vat = calcVat(refs.invoice, refs.landlord)
  const isVat = isDeposit ? false : vat.isVat
  const grossTotal = isDeposit ? Number(inv.total) || 0 : vat.total || Number(inv.total) || 0
  const docTitle = isDeposit
    ? 'ใบแจ้งหนี้ · เงินประกัน'
    : isVat ? 'ใบแจ้งหนี้ / ใบกำกับภาษี' : 'ใบแจ้งหนี้'
  const docTitleEn = isDeposit
    ? 'SECURITY DEPOSIT INVOICE'
    : isVat ? 'INVOICE / TAX INVOICE' : 'INVOICE'

  const freq = inv.freqType ?? 'monthly'
  const freqLbl = inv.freqLabel ?? FREQ_LABELS[freq] ?? 'รายเดือน'
  const month = monthLabelBE(inv.month ?? '')

  const tenantName = inv.tenant ?? refs.tenant?.data?.name ?? c?.tenant ?? ''
  const propertyName = inv.property ?? refs.property?.data?.name ?? ''
  const contractNo = c?.no ?? ''

  // PromptPay QR (only when amount > 0 and landlord has a PromptPay ID)
  const hasPP = !!landlord.promptPayId && grossTotal > 0
  const qrSrc = hasPP
    ? await generateQrDataUrl(landlord.promptPayId, grossTotal, String(refs.invoice.id))
    : null

  function halfContent(copyLabel: 'ต้นฉบับ' | 'สำเนา'): string {
    const isCopy = copyLabel === 'สำเนา'
    const items = inv.items ?? []
    const itemsHtml = items
      .map(
        (it, i) =>
          `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:7px 10px;color:#334155">${
            i + 1
          }. ${esc(enrichDesc(it, refs.invoice))}</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#1e293b;font-variant-numeric:tabular-nums">${fmtBaht(it.amount, 2)}</td></tr>`,
      )
      .join('')

    // Bank + QR section
    let bkSection = ''
    if (hasPP && qrSrc) {
      bkSection += '<div style="display:flex;gap:10px;align-items:center;border:1px solid #bfdbfe;background:#f0f9ff;border-radius:8px;padding:9px 12px;margin-bottom:7px">'
      bkSection += `<img src="${qrSrc}" style="width:58px;height:58px;border-radius:6px;border:1px solid #bfdbfe;flex-shrink:0;image-rendering:pixelated">`
      bkSection += '<div style="flex:1;font-size:9px;color:#475569;line-height:1.6">'
      bkSection += '<div style="font-weight:700;color:#1e40af;font-size:10px;margin-bottom:2px">สแกนจ่ายผ่าน PromptPay</div>'
      if (landlord.promptPayName)
        bkSection += `<div><b>ชื่อบัญชี:</b> ${esc(landlord.promptPayName)}</div>`
      if (landlord.promptPayBank || bank.bank)
        bkSection += `<div><b>ธนาคาร:</b> ${esc(landlord.promptPayBank || bank.bank)}</div>`
      bkSection += `<div><b>PromptPay:</b> ${esc(landlord.promptPayId)}</div>`
      bkSection += `<div><b>จำนวน:</b> <span style="color:#1e40af;font-weight:700">${fmtBaht(grossTotal, 2)} บาท</span></div>`
      bkSection += '</div></div>'
    }
    bkSection += `<div style="display:flex;gap:10px;align-items:center;border:1px solid ${hasPP ? '#e2e8f0' : '#bfdbfe'};background:${hasPP ? '#f8fafc' : '#f0f9ff'};border-radius:8px;padding:9px 12px;margin-bottom:7px">`
    if (!hasPP) {
      bkSection += '<div style="width:58px;height:58px;border-radius:6px;border:2px dashed #bfdbfe;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px">🏦</div>'
    } else {
      bkSection += '<div style="width:20px;flex-shrink:0;text-align:center;font-size:14px">🏦</div>'
    }
    bkSection += '<div style="flex:1;font-size:9px;color:#475569;line-height:1.6">'
    bkSection += `<div style="font-weight:700;color:#1e40af;font-size:10px;margin-bottom:2px">${bank.bank ? 'โอนเข้าบัญชี ' + esc(bank.bank) : 'โอนเงินผ่านธนาคาร'}</div>`
    bkSection += bank.acctNo
      ? `<div style="font-size:14px;font-weight:800;color:#1e293b;letter-spacing:1px;font-variant-numeric:tabular-nums">${esc(bank.acctNo)}</div>`
      : '<div style="font-size:9px;color:#64748b;font-style:italic">ยังไม่ได้ตั้งค่าเลขบัญชี</div>'
    if (bank.accountName)
      bkSection += `<div style="color:#64748b">ชื่อบัญชี: ${esc(bank.accountName)}</div>`
    bkSection += '</div></div>'

    const note = (inv.note as string | undefined) ?? ''

    return `<div class="half ${isCopy ? 'copy-half' : 'top-half'}">
      ${isCopy ? '<div class="copy-watermark">สำเนา / COPY</div>' : ''}
      <div class="half-content" style="display:flex;flex-direction:column;height:100%">

        <!-- Header -->
        <div style="display:flex;gap:12px;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid #1e293b;margin-bottom:10px;flex-shrink:0">
          ${landlord.logo ? `<img src="${esc(landlord.logo)}" style="width:48px;height:48px;object-fit:contain;border-radius:6px;flex-shrink:0;border:1px solid #e2e8f0">` : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
              <span style="font-size:${isVat ? 18 : 24}px;font-weight:800;color:#1e293b;letter-spacing:.5px;line-height:1.1">${docTitle}</span>
              <span style="font-size:10px;color:#64748b;font-weight:400">${docTitleEn}</span>
            </div>
            ${landlord.name ? `<div style="font-size:12px;font-weight:700;color:#1e293b;margin-top:4px">${esc(landlord.name)}</div>` : ''}
            ${landlord.address ? `<div style="font-size:9px;color:#64748b;line-height:1.5;margin-top:1px">${esc(landlord.address)}</div>` : ''}
            ${landlord.phone || landlord.taxId ? `<div style="font-size:9px;color:#64748b;margin-top:1px">${landlord.phone ? 'โทร ' + esc(landlord.phone) : ''}${landlord.phone && landlord.taxId ? ' &nbsp;·&nbsp; ' : ''}${landlord.taxId ? 'เลขผู้เสียภาษี ' + esc(landlord.taxId) : ''}</div>` : ''}
          </div>
          <div style="flex-shrink:0;text-align:right">
            <span style="display:inline-block;font-size:9px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:3px 10px;color:#475569;font-weight:600">${copyLabel}</span>
          </div>
        </div>

        <!-- Meta -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid #cbd5e1;flex-shrink:0">
          <div style="padding:8px 12px;background:#f8fafc;border-right:1px solid #e2e8f0"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">เลขที่</div><div style="font-size:12px;font-weight:800;color:#1e293b;line-height:1.2">${esc(inv.invoiceNo ?? '')}</div></div>
          <div style="padding:8px 12px;background:#f8fafc;border-right:1px solid #e2e8f0"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">วันที่ออก</div><div style="font-size:12px;font-weight:700;color:#334155">${esc(inv.date || todayBE)}</div></div>
          <div style="padding:8px 12px;background:#f1f5f9;border-right:1px solid #e2e8f0"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">รอบบิล</div><div style="font-size:12px;font-weight:700;color:#334155">${month}</div></div>
          <div style="padding:8px 12px;background:#f1f5f9"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">กำหนดชำระ</div><div style="font-size:13px;font-weight:800;color:#b91c1c">${esc(inv.dueDate || '—')}</div></div>
        </div>

        <!-- Parties -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px">
            <div style="font-size:7px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ผู้เช่า / Bill To</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(tenantName)}</div>
            ${tenantAddr ? `<div style="font-size:9px;color:#64748b;line-height:1.4;margin-top:3px">${esc(tenantAddr)}</div>` : '<div style="font-size:9px;color:#dc2626;font-weight:600;margin-top:3px">⚠️ ไม่มีที่อยู่ผู้เช่า — แก้ในสัญญาก่อน</div>'}
            ${tenantTaxId ? `<div style="font-size:9px;color:#92400e;margin-top:2px;font-weight:600">เลขผู้เสียภาษี: ${esc(tenantTaxId)}</div>` : '<div style="font-size:9px;color:#dc2626;font-weight:600;margin-top:2px">⚠️ ไม่มีเลขผู้เสียภาษี — แก้ในสัญญาก่อน</div>'}
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px">
            <div style="font-size:7px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ทรัพย์สิน / Property</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(propertyName || '—')}</div>
            ${contractNo ? `<div style="font-size:9px;color:#64748b;margin-top:3px">สัญญา: ${esc(contractNo)}</div>` : ''}
            <div style="font-size:9px;color:#64748b;margin-top:2px">${esc(freqLbl)}</div>
          </div>
        </div>

        <!-- Items table -->
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;border-radius:6px;overflow:hidden;border:1px solid #cbd5e1">
          <tr style="background:#f1f5f9;border-bottom:2px solid #64748b">
            <th style="padding:7px 10px;text-align:left;font-size:8px;font-weight:700;color:#334155;letter-spacing:.5px">รายการ</th>
            <th style="padding:7px 10px;text-align:right;font-size:8px;font-weight:700;color:#334155;letter-spacing:.5px;width:120px">จำนวนเงิน (บาท)</th>
          </tr>
          ${itemsHtml}
        </table>
        ${isVat ? `<div style="display:flex;justify-content:flex-end;margin-top:6px;margin-bottom:6px">
          <table style="font-size:10px;border-collapse:collapse">
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">มูลค่าก่อนภาษี (Subtotal)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#1e293b;min-width:110px">${fmtBaht(vat.subtotal, 2)}</td></tr>
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">ภาษีมูลค่าเพิ่ม ${vat.rate}% (VAT)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e;min-width:110px">${fmtBaht(vat.vatAmount, 2)}</td></tr>
          </table>
        </div>` : ''}
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <div style="background:#f8fafc;color:#1e293b;border:2px solid #1e293b;padding:8px 20px;border-radius:0 0 8px 8px;display:flex;align-items:center;gap:14px">
            <span style="font-size:10px;color:#64748b;font-weight:500">${isVat ? 'ยอดรวมสุทธิ (รวม VAT)' : 'ยอดรวมทั้งสิ้น'}</span>
            <span style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums">${fmtBaht(grossTotal, 2)}</span>
            <span style="font-size:9px;color:#64748b">บาท</span>
          </div>
        </div>

        ${bkSection}

        ${note ? `<div style="padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:8.5px;color:#92400e;margin-bottom:6px"><b>หมายเหตุ:</b> ${esc(note.replace(/\n/g, ' '))}</div>` : ''}

        <!-- Signature -->
        <div style="margin-top:auto;padding-top:9px;border-top:1px solid #e2e8f0;display:flex;justify-content:center">
          <div style="text-align:center;min-width:140px;max-width:180px">
            <div style="height:48px;border-bottom:1px dotted #64748b;width:140px;margin:0 auto 5px"></div>
            <div style="font-size:9px;font-weight:600;color:#334155;letter-spacing:.3px">ผู้วางบิล</div>
            <div style="font-size:8px;color:#64748b;margin-top:2px">ลงนาม / วันที่</div>
          </div>
        </div>

      </div>
    </div>`
  }

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>${esc(docTitle + ' ' + (inv.invoiceNo ?? ''))}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${INV_PRINT_CSS}</style></head><body class="embed">
<div class="page">${halfContent('ต้นฉบับ')}${halfContent('สำเนา')}</div>
</body></html>`
}

/* ─────────── Receipt HTML ─────────── */

export async function buildReceiptHtml(refs: InvoiceHtmlRefs): Promise<string> {
  const inv = refs.invoice.data
  const c = refs.contract?.data
  const today = new Date()
  const todayBE = dateToBE(today)
  const isDeposit = (inv.category ?? 'rent') === 'deposit'

  const landlord = resolveLandlord(refs)
  const tenantAddr = resolveTenantAddr(refs)
  const tenantTaxId = refs.tenant?.data?.taxId ?? c?.taxId ?? ''

  const vat = calcVat(refs.invoice, refs.landlord)
  const isVat = isDeposit ? false : vat.isVat
  const grossTotal = isDeposit ? Number(inv.total) || 0 : vat.total
  const docTitle = isDeposit
    ? 'ใบรับเงินประกันการเช่า'
    : isVat
      ? 'ใบเสร็จรับเงิน / ใบกำกับภาษี'
      : 'ใบเสร็จรับเงิน'
  const docTitleEn = isDeposit
    ? 'SECURITY DEPOSIT RECEIPT'
    : isVat
      ? 'RECEIPT / TAX INVOICE'
      : 'RECEIPT'

  const freq = inv.freqType ?? 'monthly'
  const freqLbl = inv.freqLabel ?? FREQ_LABELS[freq] ?? 'รายเดือน'
  const month = monthLabelBE(inv.month ?? '')
  const tenantName = inv.tenant ?? refs.tenant?.data?.name ?? c?.tenant ?? ''
  const propertyName = inv.property ?? refs.property?.data?.name ?? ''
  const contractNo = c?.no ?? ''

  const paidLast: InvoicePayment | undefined = (inv.payments ?? []).slice(-1)[0]
  const paidDate = paidLast?.date ?? inv.paidAt
    ? new Date(String(paidLast?.date ?? inv.paidAt))
    : new Date()
  const paidDateBE = dateToBE(paidDate)
  const recNo = (inv.receiptNo as string) ??
    (inv.invoiceNo ? inv.invoiceNo.replace('INV', 'REC') : `REC-${refs.invoice.id}`)
  const taxInvoiceNo = (inv.taxInvoiceNo as string) ?? ''

  const invItems = inv.items?.length
    ? inv.items
    : isDeposit
      ? [{ desc: freqLbl || 'เงินประกัน', amount: Number(inv.total) || 0 }]
      : []

  // Color palette: green for rent receipt, cyan for deposit
  const palette = isDeposit
    ? {
        accent: '#0891b2',
        accentDark: '#164e63',
        bg: '#ecfeff',
        bgSoft: '#cffafe',
        border: '#a5f3fc',
      }
    : {
        accent: '#059669',
        accentDark: '#065f46',
        bg: '#f0fdf4',
        bgSoft: '#dcfce7',
        border: '#bbf7d0',
      }

  function halfReceipt(copyLabel: 'ต้นฉบับ' | 'สำเนา'): string {
    const isCopy = copyLabel === 'สำเนา'
    const itemsHtml = invItems
      .map(
        (it, i) =>
          `<tr style="border-bottom:1px solid ${palette.bg}"><td style="padding:7px 10px;color:#334155">${
            i + 1
          }. ${esc(isDeposit ? (it.desc ?? '') : enrichDesc(it, refs.invoice))}</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#1e293b;font-variant-numeric:tabular-nums">${fmtBaht(it.amount, 2)}</td></tr>`,
      )
      .join('')
    const note = (inv.note as string | undefined) ?? ''

    return `<div class="half ${isCopy ? 'copy-half' : 'top-half'}">
      ${isCopy ? '<div class="copy-watermark">สำเนา / COPY</div>' : ''}
      <div class="half-content" style="display:flex;flex-direction:column;height:100%">

        <!-- Header -->
        <div style="display:flex;gap:12px;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid ${palette.accent};margin-bottom:10px;flex-shrink:0">
          ${landlord.logo ? `<img src="${esc(landlord.logo)}" style="width:48px;height:48px;object-fit:contain;border-radius:6px;flex-shrink:0;border:1px solid ${palette.bgSoft}">` : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
              <span style="font-size:${isVat ? 18 : 24}px;font-weight:800;color:${palette.accent};letter-spacing:.5px;line-height:1.1">${docTitle}</span>
              <span style="font-size:10px;color:#64748b;font-weight:400">${docTitleEn}</span>
            </div>
            ${landlord.name ? `<div style="font-size:12px;font-weight:700;color:#1e293b;margin-top:4px">${esc(landlord.name)}</div>` : ''}
            ${landlord.address ? `<div style="font-size:9px;color:#64748b;line-height:1.5;margin-top:1px">${esc(landlord.address)}</div>` : ''}
            ${landlord.phone || landlord.taxId ? `<div style="font-size:9px;color:#64748b;margin-top:1px">${landlord.phone ? 'โทร ' + esc(landlord.phone) : ''}${landlord.phone && landlord.taxId ? ' &nbsp;·&nbsp; ' : ''}${landlord.taxId ? 'เลขผู้เสียภาษี ' + esc(landlord.taxId) : ''}</div>` : ''}
          </div>
          <div style="flex-shrink:0;text-align:right">
            <span style="display:inline-block;font-size:9px;background:${palette.bg};border:1px solid ${palette.border};border-radius:5px;padding:3px 10px;color:${palette.accent};font-weight:600">${copyLabel}</span>
            ${isVat && taxInvoiceNo ? `<div style="font-size:8px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:3px 8px;margin-top:4px;font-weight:700">เลขใบกำกับภาษี<br>${esc(taxInvoiceNo)}</div>` : ''}
          </div>
        </div>

        <!-- Meta -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid ${palette.border};flex-shrink:0">
          <div style="padding:8px 12px;background:${palette.bg};border-right:1px solid ${palette.border}"><div style="font-size:8px;color:${palette.accent};font-weight:600;letter-spacing:.4px;margin-bottom:4px">เลขที่ใบเสร็จ</div><div style="font-size:12px;font-weight:800;color:${palette.accentDark};line-height:1.2">${esc(recNo)}</div></div>
          <div style="padding:8px 12px;background:${palette.bg};border-right:1px solid ${palette.border}"><div style="font-size:8px;color:${palette.accent};font-weight:600;letter-spacing:.4px;margin-bottom:4px">อ้างอิงใบแจ้งหนี้</div><div style="font-size:12px;font-weight:700;color:${palette.accentDark}">${esc(inv.invoiceNo ?? '')}</div></div>
          <div style="padding:8px 12px;background:${palette.bg};border-right:1px solid ${palette.border}"><div style="font-size:8px;color:${palette.accent};font-weight:600;letter-spacing:.4px;margin-bottom:4px">รอบบิล</div><div style="font-size:12px;font-weight:700;color:${palette.accentDark}">${month}</div></div>
          <div style="padding:8px 12px;background:${palette.bg}"><div style="font-size:8px;color:${palette.accent};font-weight:600;letter-spacing:.4px;margin-bottom:4px">วันที่ชำระ</div><div style="font-size:13px;font-weight:800;color:${palette.accentDark}">${paidDateBE}</div></div>
        </div>

        <!-- Parties -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="border:1px solid ${palette.border};border-radius:6px;padding:9px 12px;background:${palette.bg}">
            <div style="font-size:7px;font-weight:700;color:${palette.accent};letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ได้รับเงินจาก / Received From</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(tenantName)}</div>
            ${tenantAddr ? `<div style="font-size:9px;color:#64748b;line-height:1.4;margin-top:3px">${esc(tenantAddr)}</div>` : ''}
            ${tenantTaxId ? `<div style="font-size:9px;color:#92400e;margin-top:2px;font-weight:600">เลขผู้เสียภาษี: ${esc(tenantTaxId)}</div>` : ''}
          </div>
          <div style="border:1px solid ${palette.border};border-radius:6px;padding:9px 12px;background:${palette.bg}">
            <div style="font-size:7px;font-weight:700;color:${palette.accent};letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ทรัพย์สิน / Property</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(propertyName || '—')}</div>
            ${contractNo ? `<div style="font-size:9px;color:#64748b;margin-top:3px">สัญญา: ${esc(contractNo)}</div>` : ''}
            <div style="font-size:9px;color:#64748b;margin-top:2px">${esc(freqLbl)}</div>
          </div>
        </div>

        <!-- Items -->
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;border-radius:6px;overflow:hidden;border:1px solid ${palette.border}">
          <tr style="background:${palette.bg};border-bottom:2px solid ${palette.accent}">
            <th style="padding:7px 10px;text-align:left;font-size:8px;font-weight:700;color:${palette.accentDark};letter-spacing:.5px">รายการ</th>
            <th style="padding:7px 10px;text-align:right;font-size:8px;font-weight:700;color:${palette.accentDark};letter-spacing:.5px;width:120px">จำนวนเงิน (บาท)</th>
          </tr>
          ${itemsHtml}
        </table>
        ${isVat ? `<div style="display:flex;justify-content:flex-end;margin-top:6px;margin-bottom:6px">
          <table style="font-size:10px;border-collapse:collapse">
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">มูลค่าก่อนภาษี (Subtotal)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#1e293b;min-width:110px">${fmtBaht(vat.subtotal, 2)}</td></tr>
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">ภาษีมูลค่าเพิ่ม ${vat.rate}% (VAT)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e;min-width:110px">${fmtBaht(vat.vatAmount, 2)}</td></tr>
          </table>
        </div>` : ''}
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <div style="background:${palette.bg};color:${palette.accentDark};border:2px solid ${palette.accent};padding:8px 20px;border-radius:0 0 8px 8px;display:flex;align-items:center;gap:14px">
            <span style="font-size:10px;opacity:.7;font-weight:500">${isVat ? 'ยอดรวมสุทธิ (รวม VAT)' : 'ยอดรวมทั้งสิ้น'}</span>
            <span style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums">${fmtBaht(grossTotal, 2)}</span>
            <span style="font-size:9px;opacity:.55">บาท</span>
          </div>
        </div>

        ${note ? `<div style="padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:8.5px;color:#92400e;margin-bottom:6px"><b>หมายเหตุ:</b> ${esc(note.replace(/\n/g, ' '))}</div>` : ''}

        <!-- Signature: 2 columns (รับเงิน · ผู้ชำระ) -->
        <div style="margin-top:auto;padding-top:9px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end">
          <div style="text-align:center;min-width:120px">
            <div style="height:44px;border-bottom:1px dotted #64748b;width:120px;margin:0 auto 4px"></div>
            <div style="font-size:9px;font-weight:600;color:${palette.accent}">ผู้รับเงิน</div>
            <div style="font-size:8px;color:#64748b;margin-top:1px">ลงนาม / วันที่</div>
          </div>
          <div style="font-size:8px;color:#64748b;text-align:center;line-height:1.6">${esc(landlord.name)}<br>${esc(recNo)} · ${todayBE}</div>
          <div style="text-align:center;min-width:120px">
            <div style="height:44px;border-bottom:1px dotted #64748b;width:120px;margin:0 auto 4px"></div>
            <div style="font-size:9px;font-weight:600;color:#334155">ผู้ชำระเงิน</div>
            <div style="font-size:8px;color:#64748b;margin-top:1px">ลงนาม / วันที่</div>
          </div>
        </div>
      </div>
    </div>`
  }

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>${esc(docTitle + ' ' + recNo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${INV_PRINT_CSS}</style></head><body class="embed">
<div class="page">${halfReceipt('ต้นฉบับ')}${halfReceipt('สำเนา')}</div>
</body></html>`
}

/* ─────────── CSS (verbatim port from v1 modules/19-invoices.js _INV_PRINT_CSS) ─────────── */
const INV_PRINT_CSS = `@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box;font-family:'Sarabun',sans-serif}
body{background:#fff;color:#1e293b;font-size:11px;line-height:1.4}
.page{width:210mm;height:297mm;margin:0 auto;position:relative;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.half{width:100%;height:148.5mm;padding:10mm 14mm 8mm;position:relative;overflow:hidden}
.top-half{border-bottom:1px dashed #64748b}
.copy-half{position:relative}
.copy-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:48px;font-weight:800;color:rgba(148,163,184,.08);letter-spacing:6px;pointer-events:none;z-index:0;white-space:nowrap}
.half-content{position:relative;z-index:1}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}
@media screen{body{background:#e2e8f0;padding:20px}.page{box-shadow:0 4px 24px rgba(0,0,0,.12);border-radius:4px;margin-bottom:20px}body.embed{background:#f8fafc;padding:10px 0}}`
