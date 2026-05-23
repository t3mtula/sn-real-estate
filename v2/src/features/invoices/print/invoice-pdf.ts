/**
 * Invoice PDF — A4 portrait · 1 page typical
 *
 * Sections: header (landlord ที่อยู่ + เลขผู้เสียภาษี · invoice no + date),
 * recipient (ผู้เช่า), items table, totals + VAT, footer (bank account + signatures).
 *
 * Uses pdfmake via @/lib/pdf (THSarabunNew already loaded).
 */

import type { Content, TDocumentDefinitions } from '@/lib/pdf'
import type { BankAccount } from '@/features/bank-accounts/types'
import type { Contract } from '@/features/contracts/types'
import type { Landlord } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'
import type { Invoice, InvoiceItem } from '@/features/invoices/types'
import { fmtThaiLong, parseBE, spellAmt } from '@/lib/thai'

type Refs = {
  invoice: Invoice
  contract?: Contract | null
  tenant?: Tenant | null
  landlord?: Landlord | null
  property?: Property | null
  bank?: BankAccount | null
}

const C = {
  ink: '#1e293b',
  inkSoft: '#475569',
  inkFaint: '#94a3b8',
  brand: '#0f4c5c',
  brandSoft: '#5e8696',
  rule: '#cbd5e1',
  ruleSoft: '#e2e8f0',
  bgSoft: '#f1f5f9',
  bgFainter: '#f8fafc',
}

function buildAddress(parts: {
  addrLine?: string
  addrSubdistrict?: string
  addrDistrict?: string
  addrProvince?: string
  addrPostal?: string
}): string {
  return (
    [
      parts.addrLine,
      parts.addrSubdistrict && `ต.${parts.addrSubdistrict}`,
      parts.addrDistrict && `อ.${parts.addrDistrict}`,
      parts.addrProvince && `จ.${parts.addrProvince}`,
      parts.addrPostal,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || '—'
  )
}

function landlordAddress(l: Landlord | null | undefined, fallback?: string) {
  if (!l) return (fallback ?? '').trim() || '—'
  return buildAddress({
    addrLine: l.data?.addrLine,
    addrSubdistrict: l.data?.addrSubdistrict,
    addrDistrict: l.data?.addrDistrict,
    addrProvince: l.data?.addrProvince,
    addrPostal: l.data?.addrPostal,
  })
}

function tenantAddress(t: Tenant | null | undefined, fallback?: string) {
  if (!t) return (fallback ?? '').trim() || '—'
  return buildAddress({
    addrLine: t.data?.addrLine,
    addrSubdistrict: t.data?.addrSubdistrict,
    addrDistrict: t.data?.addrDistrict,
    addrProvince: t.data?.addrProvince,
    addrPostal: t.data?.addrPostal,
  })
}

function fmtBaht(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function sectionBar(label: string, sub?: string): Content {
  const cells: Content[] = [
    { text: label, color: C.brand, bold: true, fontSize: 13 },
  ]
  if (sub) {
    cells.push({ text: sub, color: C.brandSoft, fontSize: 11, alignment: 'right' })
  }
  return {
    table: {
      widths: ['*', 'auto'],
      body: [cells],
    },
    layout: {
      fillColor: () => C.bgSoft,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
    margin: [0, 6, 0, 4],
  }
}

function kv(label: string, value: string | Content): Content {
  // Ensure second column always has width — passing a Content object without
  // width makes pdfmake produce NaN dimensions → iframe PDF render fails.
  // biome-ignore lint/suspicious/noExplicitAny: pdfmake Content union too narrow
  const valueCol: Content =
    typeof value === 'string'
      ? { width: '*', text: value, color: C.ink, fontSize: 12 }
      : ({ width: '*', color: C.ink, fontSize: 12, ...(value as object) } as any)
  return {
    columns: [
      { width: 110, text: label, color: C.inkSoft, fontSize: 11 },
      valueCol,
    ],
    margin: [0, 1, 0, 1],
  }
}

export function buildInvoicePdf(refs: Refs): TDocumentDefinitions {
  const { invoice, landlord, tenant, property, bank, contract } = refs
  const d = invoice.data ?? {}

  const landlordName =
    landlord?.data?.name?.trim() ||
    (d.landlord as string | undefined) ||
    '—'
  const landlordTaxId = landlord?.data?.taxId?.trim() ?? ''
  const landlordPhone = landlord?.data?.phone?.trim() ?? ''
  const lAddr = landlordAddress(landlord, contract?.data?.landlordAddr as string | undefined)

  const tenantName =
    tenant?.data?.name?.trim() ||
    (d.tenant as string | undefined) ||
    '—'
  const tenantTaxId = tenant?.data?.taxId?.trim() ?? ''
  const tenantPhone = tenant?.data?.phone?.trim() ?? ''
  const tAddr = tenantAddress(tenant, contract?.data?.tenantAddr as string | undefined)

  const propertyName = property?.data?.name?.trim() ?? (d.property as string | undefined) ?? '—'
  const propertyAddr = property?.data?.address?.trim() ?? ''

  const items: InvoiceItem[] = Array.isArray(d.items) && d.items.length > 0
    ? d.items
    : [{ desc: 'ค่าเช่า', amount: Number(d.total) || 0 }]
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)

  const vatMode = (d.vatMode as 'none' | 'inclusive' | 'exclusive' | undefined) ?? 'none'
  const vatRate = Number(d.vatRate) || 0
  let vatLine: Content[] = []
  let displayTotal = subtotal
  let beforeVat = subtotal
  let vatAmt = 0
  if (vatMode === 'exclusive' && vatRate > 0) {
    vatAmt = +(subtotal * (vatRate / 100)).toFixed(2)
    displayTotal = +(subtotal + vatAmt).toFixed(2)
    beforeVat = subtotal
  } else if (vatMode === 'inclusive' && vatRate > 0) {
    beforeVat = +(subtotal / (1 + vatRate / 100)).toFixed(2)
    vatAmt = +(subtotal - beforeVat).toFixed(2)
    displayTotal = subtotal
  }

  const issueDate = d.date ?? ''
  const dueDate = d.dueDate ?? ''
  const issueDateLong = (() => {
    const dt = parseBE(issueDate)
    return dt ? fmtThaiLong(dt.toDate()) : issueDate || '—'
  })()
  const dueDateLong = (() => {
    const dt = parseBE(dueDate)
    return dt ? fmtThaiLong(dt.toDate()) : dueDate || '—'
  })()

  const itemsTable: Content = {
    margin: [0, 4, 0, 0],
    table: {
      headerRows: 1,
      widths: ['auto', '*', 'auto'],
      body: [
        [
          { text: 'ลำดับ', color: '#fff', bold: true, fontSize: 11, alignment: 'center' },
          { text: 'รายการ', color: '#fff', bold: true, fontSize: 11 },
          { text: 'จำนวนเงิน (บาท)', color: '#fff', bold: true, fontSize: 11, alignment: 'right' },
        ],
        ...items.map((it, idx) => [
          { text: String(idx + 1), alignment: 'center', fontSize: 12 },
          { text: it.desc ?? '—', fontSize: 12 },
          { text: fmtBaht(Number(it.amount) || 0), alignment: 'right', fontSize: 12 },
        ]),
      ] as Content[][],
    },
    layout: {
      fillColor: (rowIndex: number) =>
        rowIndex === 0 ? C.brand : rowIndex % 2 === 0 ? C.bgFainter : null,
      hLineColor: () => C.rule,
      vLineColor: () => C.rule,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
  }

  const totalsTable: Content = {
    margin: [0, 4, 0, 4],
    table: {
      widths: ['*', 'auto'],
      body: [
        ...(vatMode === 'none'
          ? []
          : [
              [
                { text: 'มูลค่าก่อนภาษี', alignment: 'right', color: C.inkSoft, fontSize: 11 },
                { text: fmtBaht(beforeVat), alignment: 'right', fontSize: 12 },
              ] as Content[],
              [
                { text: `ภาษีมูลค่าเพิ่ม ${vatRate}%`, alignment: 'right', color: C.inkSoft, fontSize: 11 },
                { text: fmtBaht(vatAmt), alignment: 'right', fontSize: 12 },
              ] as Content[],
            ]),
        [
          { text: 'ยอดรวมทั้งสิ้น', alignment: 'right', color: C.brand, bold: true, fontSize: 13 },
          { text: fmtBaht(displayTotal), alignment: 'right', bold: true, color: C.brand, fontSize: 14 },
        ] as Content[],
      ],
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === node.table.body.length - 1 ? 1 : 0,
      vLineWidth: () => 0,
      hLineColor: () => C.brand,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
  }
  // vatLine kept for potential reuse if we move to columns
  void vatLine

  const bankBlock: Content = bank
    ? {
        table: {
          widths: ['auto', '*'],
          body: [
            [
              { text: 'ธนาคาร', color: C.inkSoft, fontSize: 11, border: [false, false, false, false] },
              {
                text: `${bank.data?.bank ?? ''}${
                  bank.data?.branch ? ` (${bank.data.branch})` : ''
                }`,
                fontSize: 12,
                border: [false, false, false, false],
              },
            ],
            [
              { text: 'เลขบัญชี', color: C.inkSoft, fontSize: 11, border: [false, false, false, false] },
              { text: bank.data?.acctNo ?? '—', fontSize: 12, bold: true, border: [false, false, false, false] },
            ],
            [
              { text: 'ชื่อบัญชี', color: C.inkSoft, fontSize: 11, border: [false, false, false, false] },
              {
                text: bank.data?.accountName ?? landlordName,
                fontSize: 12,
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: 'noBorders',
      }
    : {
        text: '— ไม่ได้ระบุบัญชีรับเงิน —',
        color: C.inkFaint,
        italics: true,
        fontSize: 11,
      }

  const signatureBlock: Content = {
    columns: [
      {
        stack: [
          { text: '\n\n\n\n', fontSize: 8 },
          { text: '...........................................', alignment: 'center' },
          { text: `(${landlordName})`, alignment: 'center', fontSize: 11 },
          { text: 'ผู้รับเงิน / ผู้ให้เช่า', alignment: 'center', color: C.inkSoft, fontSize: 10 },
        ],
        width: '*',
      },
      {
        stack: [
          { text: '\n\n\n\n', fontSize: 8 },
          { text: '...........................................', alignment: 'center' },
          { text: `(${tenantName})`, alignment: 'center', fontSize: 11 },
          { text: 'ผู้ชำระเงิน / ผู้เช่า', alignment: 'center', color: C.inkSoft, fontSize: 10 },
        ],
        width: '*',
      },
    ],
    margin: [0, 10, 0, 0],
  }

  const docNoText = (d.invoiceNo ?? '').trim() || `#${invoice.id}`

  return {
    info: {
      title: `Invoice ${docNoText}`,
      author: landlordName,
      subject: 'ใบแจ้งหนี้',
    },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: [
      // ── Header ──
      {
        columns: [
          {
            stack: [
              { text: landlordName, fontSize: 16, bold: true, color: C.brand },
              { text: lAddr, fontSize: 11, color: C.inkSoft, margin: [0, 2, 0, 0] },
              ...(landlordTaxId
                ? [{ text: `เลขผู้เสียภาษี ${landlordTaxId}`, fontSize: 11, color: C.inkSoft }]
                : []),
              ...(landlordPhone
                ? [{ text: `โทร ${landlordPhone}`, fontSize: 11, color: C.inkSoft }]
                : []),
            ],
            width: '*',
          },
          {
            stack: [
              { text: 'ใบแจ้งหนี้', alignment: 'right', fontSize: 20, bold: true, color: C.brand },
              { text: 'INVOICE', alignment: 'right', fontSize: 10, color: C.brandSoft, characterSpacing: 1.5 },
              {
                table: {
                  widths: ['auto', 'auto'],
                  body: [
                    [
                      { text: 'เลขที่', color: C.inkSoft, fontSize: 10, border: [false, false, false, false] },
                      { text: docNoText, fontSize: 12, bold: true, border: [false, false, false, false] },
                    ],
                    [
                      { text: 'วันที่ออก', color: C.inkSoft, fontSize: 10, border: [false, false, false, false] },
                      { text: issueDate || '—', fontSize: 12, border: [false, false, false, false] },
                    ],
                    [
                      { text: 'ครบกำหนด', color: C.inkSoft, fontSize: 10, border: [false, false, false, false] },
                      { text: dueDate || '—', fontSize: 12, bold: true, color: C.brand, border: [false, false, false, false] },
                    ],
                  ],
                },
                layout: 'noBorders',
                margin: [0, 6, 0, 0],
                alignment: 'right',
              } as Content,
            ],
            width: 'auto',
          },
        ],
      },

      // ── Recipient ──
      sectionBar('เรียน · ผู้เช่า', dueDate ? `กำหนดชำระภายใน ${dueDateLong}` : undefined),
      kv('ชื่อ', { text: tenantName, bold: true, fontSize: 13 }),
      ...(tenantTaxId ? [kv('เลขผู้เสียภาษี', tenantTaxId)] : []),
      ...(tenantPhone ? [kv('โทร', tenantPhone)] : []),
      kv('ที่อยู่', tAddr),
      ...(propertyName !== '—' ? [kv('ทรัพย์สิน', propertyName)] : []),
      ...(propertyAddr ? [kv('ที่ตั้ง', propertyAddr)] : []),

      // ── Items ──
      sectionBar('รายการ', d.freqLabel || ''),
      itemsTable,
      totalsTable,
      {
        text: `ตัวอักษร: (${spellAmt(displayTotal)})`,
        margin: [0, 2, 0, 6],
        color: C.inkSoft,
        fontSize: 11,
        italics: true,
      },

      // ── Bank · Footer ──
      sectionBar('ชำระโดยโอนเข้าบัญชี'),
      bankBlock,

      // ── Signature ──
      signatureBlock,

      // ── Issue date footer ──
      {
        text: `ออกใบแจ้งหนี้ ณ วันที่ ${issueDateLong}`,
        alignment: 'right',
        color: C.inkFaint,
        fontSize: 10,
        margin: [0, 12, 0, 0],
      },
    ],
    defaultStyle: { font: 'THSarabunNew', fontSize: 12, color: C.ink, lineHeight: 1.35 },
  }
}
