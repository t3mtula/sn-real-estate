/**
 * Contract PDF — 2 pages (สัญญาหลัก + เอกสารแนบท้าย)
 *
 * Layout ported from v1 (modules/17-contract-print.js) — same sections,
 * same structure ลูกน้องคุ้นเคย — but cleaner typography + tighter table
 * borders + brand color teal #0F4C5C.
 *
 * Body content uses DEFAULT_TEMPLATE (12 numbered clauses + sub-clauses
 * + intro + closing) ported verbatim from v1 DEFAULT_CLAUSES so the legal
 * wording is identical.
 *
 * Template + clause overrides (per-contract edits) — coming in PRINT-3.
 * For now we read DEFAULT_TEMPLATE directly.
 */

import type { Content, TDocumentDefinitions } from '@/lib/pdf'
import type { BankAccount } from '@/features/bank-accounts/types'
import type { Contract } from '@/features/contracts/types'
import type { Landlord } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'
import type { ContractTemplate } from '@/features/templates/types'
import { fmtBE, fmtThaiLong, parseBE } from '@/lib/thai'
import {
  DEFAULT_TEMPLATE,
  htmlToInlineParts,
  renderTemplateText,
} from './default-template'

type Refs = {
  contract: Contract
  tenant?: Tenant | null
  landlord?: Landlord | null
  property?: Property | null
  bank?: BankAccount | null
  parent?: Contract | null
  /** Optional active template loaded from Supabase. Falls back to DEFAULT_TEMPLATE. */
  template?: ContractTemplate | null
}

/* ─────────── colors + spacing ─────────── */

const C = {
  ink: '#1e293b', // body text
  inkSoft: '#475569', // secondary
  inkFaint: '#94a3b8', // captions
  brand: '#0f4c5c', // primary teal
  brandSoft: '#5e8696', // muted teal
  rule: '#cbd5e1', // borders
  ruleSoft: '#e2e8f0',
  bgSoft: '#f1f5f9', // section bar fill
  bgFainter: '#f8fafc', // table stripe
}

/* ─────────── helpers ─────────── */

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

function propertyAddress(p: Property | null | undefined): string {
  if (!p) return '—'
  return buildAddress({
    addrLine: p.data?.addr_line,
    addrSubdistrict: p.data?.addr_subdistrict,
    addrDistrict: p.data?.addr_district,
    addrProvince: p.data?.addr_province ?? p.data?.province,
    addrPostal: p.data?.addr_postal,
  })
}

function fmtAmount(n: number | string | undefined | null): string {
  if (n == null || n === '') return '—'
  const num = typeof n === 'number' ? n : Number.parseFloat(String(n).replace(/[,฿\s]/g, ''))
  if (!Number.isFinite(num)) return String(n)
  return `${num.toLocaleString('th-TH')} บาท`
}

function dateThaiLong(beStr: string | undefined): string {
  if (!beStr?.trim()) return '—'
  const d = parseBE(beStr)
  return d ? fmtThaiLong(d.toDate()) : beStr
}

function dateBE(beStr: string | undefined): string {
  if (!beStr?.trim()) return '—'
  const d = parseBE(beStr)
  return d ? fmtBE(d.toDate()) : beStr
}

/* ─────────── section building blocks ─────────── */

/** Section header bar — gray bg, teal text, bilingual label */
function sectionBar(thai: string, en: string): Content {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            text: [
              { text: thai, bold: true, color: C.brand, fontSize: 12 },
              {
                text: `   · ${en}`,
                color: C.inkFaint,
                fontSize: 9,
                characterSpacing: 1,
              },
            ],
            margin: [10, 5, 10, 5] as [number, number, number, number],
            fillColor: C.bgSoft,
          },
        ],
      ],
    },
    layout: {
      hLineColor: () => C.rule,
      vLineColor: () => C.rule,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
    margin: [0, 12, 0, 0] as [number, number, number, number],
  }
}

/** Party card cell content (Lessor or Lessee) */
function partyCell(opts: {
  thaiLabel: string
  enLabel: string
  name: string
  taxId?: string
  phone?: string
  address: string
  signerLine?: string
}): Content {
  const out: Content[] = [
    {
      text: [
        {
          text: opts.thaiLabel,
          color: C.brand,
          bold: true,
          fontSize: 9,
          characterSpacing: 0.5,
        },
        {
          text: `   · ${opts.enLabel}`,
          color: C.inkFaint,
          fontSize: 8,
          characterSpacing: 1,
        },
      ],
      margin: [0, 0, 0, 4] as [number, number, number, number],
    },
    {
      text: opts.name || '—',
      bold: true,
      color: C.brand,
      fontSize: 13,
      margin: [0, 0, 0, 3] as [number, number, number, number],
    },
  ]
  if (opts.signerLine) {
    out.push({
      text: opts.signerLine,
      italics: true,
      color: C.inkSoft,
      fontSize: 11,
      margin: [0, 0, 0, 3] as [number, number, number, number],
    })
  }
  out.push({
    text: [
      { text: 'ที่อยู่: ', color: C.inkFaint, fontSize: 10 },
      { text: opts.address, color: C.ink, fontSize: 11 },
    ],
    margin: [0, 0, 0, opts.phone || opts.taxId ? 3 : 0] as [number, number, number, number],
  })
  if (opts.phone || opts.taxId) {
    const inline: Content[] = []
    if (opts.phone) {
      inline.push(
        { text: 'โทร: ', color: C.inkFaint, fontSize: 10 } as Content,
        { text: opts.phone, color: C.ink, fontSize: 11 } as Content,
      )
    }
    if (opts.phone && opts.taxId) {
      inline.push({ text: '   ·   ', color: C.inkFaint, fontSize: 10 } as Content)
    }
    if (opts.taxId) {
      inline.push(
        { text: 'เลขผู้เสียภาษี: ', color: C.inkFaint, fontSize: 10 } as Content,
        { text: opts.taxId, color: C.ink, fontSize: 11 } as Content,
      )
    }
    out.push({ text: inline as Content })
  }
  return { stack: out }
}

/** 2-column parties table (Lessor | Lessee) */
function partiesTable(refs: Refs): Content {
  const c = refs.contract.data
  const landlordName = refs.landlord?.data?.name ?? c.landlord ?? '—'
  const landlordIsCompany = refs.landlord?.data?.partyType === 'company'
  const tenantName = refs.tenant?.data?.name ?? c.tenant ?? '—'
  const tenantIsCompany = refs.tenant?.data?.partyType === 'company'

  const landlordSignerLine =
    landlordIsCompany && refs.landlord?.data?.signerName
      ? `โดย ${refs.landlord.data.signerName}${
          refs.landlord.data.signerTitle ? ` (${refs.landlord.data.signerTitle})` : ''
        }`
      : undefined

  const tenantSigner =
    refs.tenant?.data?.signerName ?? (c.tenantSignerName as string | undefined)
  const tenantSignerTitle =
    refs.tenant?.data?.signerTitle ?? (c.tenantSignerTitle as string | undefined)
  const tenantSignerLine =
    tenantIsCompany && tenantSigner
      ? `โดย ${tenantSigner}${tenantSignerTitle ? ` (${tenantSignerTitle})` : ''}`
      : undefined

  return {
    table: {
      widths: ['*', '*'],
      body: [
        [
          partyCell({
            thaiLabel: 'ผู้ให้เช่า',
            enLabel: 'LESSOR',
            name: landlordName,
            taxId: refs.landlord?.data?.taxId,
            phone: refs.landlord?.data?.phone,
            address: landlordAddress(refs.landlord, c.landlordAddr),
            signerLine: landlordSignerLine,
          }),
          partyCell({
            thaiLabel: 'ผู้เช่า',
            enLabel: 'LESSEE',
            name: tenantName,
            taxId: refs.tenant?.data?.taxId ?? c.taxId,
            phone: refs.tenant?.data?.phone,
            address: tenantAddress(refs.tenant, c.tenantAddr),
            signerLine: tenantSignerLine,
          }),
        ],
      ],
    },
    layout: {
      hLineColor: () => C.rule,
      vLineColor: () => C.rule,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingTop: () => 10,
      paddingBottom: () => 10,
      paddingLeft: () => 12,
      paddingRight: () => 12,
    },
    margin: [0, 0, 0, 14] as [number, number, number, number],
  }
}

/** Date strip — "ทำสัญญา ณ X เมื่อวันที่ Y" */
function dateStrip(refs: Refs): Content {
  const c = refs.contract.data
  const madeAt = c.madeAt?.trim() || landlordAddress(refs.landlord, c.landlordAddr)
  const madeDate = dateThaiLong(c.madeDate)
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              {
                text: [
                  { text: 'ทำสัญญา ณ ', color: C.inkSoft, fontSize: 11 },
                  { text: madeAt, color: C.ink, bold: true, fontSize: 12 },
                ],
              },
              {
                text: [
                  { text: 'เมื่อวันที่ ', color: C.inkSoft, fontSize: 11 },
                  { text: madeDate, color: C.ink, bold: true, fontSize: 12 },
                ],
                margin: [0, 2, 0, 0] as [number, number, number, number],
              },
            ],
            margin: [12, 8, 12, 8] as [number, number, number, number],
            fillColor: C.bgFainter,
          },
        ],
      ],
    },
    layout: {
      hLineColor: () => C.rule,
      vLineColor: () => C.brand,
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 0 ? 2.5 : 0),
      paddingLeft: () => 0,
    },
    margin: [0, 0, 0, 14] as [number, number, number, number],
  }
}

/** Body: intro + clauses (with sub-clauses) + closing — uses active template or default */
function clausesBody(refs: Refs): Content[] {
  const c = refs.contract.data
  const ctx = {
    landlord: (refs.landlord?.data?.name ?? c.landlord ?? '').trim(),
    tenant: (refs.tenant?.data?.name ?? c.tenant ?? '').trim(),
  }
  // Use active template from DB if provided, else fall back to v1 default
  const tpl = refs.template?.data
    ? {
        intro: refs.template.data.intro ?? DEFAULT_TEMPLATE.intro,
        clauses: refs.template.data.clauses ?? DEFAULT_TEMPLATE.clauses,
        closing: refs.template.data.closing ?? DEFAULT_TEMPLATE.closing,
      }
    : DEFAULT_TEMPLATE

  // Per-contract clause overrides (v1 c.clauseOverrides{"0":text, "0.1":text}…)
  const overrides =
    ((c as { clauseOverrides?: Record<string, string> }).clauseOverrides ?? {}) as
      Record<string, string>

  const out: Content[] = []

  out.push({
    text: htmlToInlineParts(renderTemplateText(tpl.intro, ctx)),
    alignment: 'justify',
    margin: [0, 0, 0, 8] as [number, number, number, number],
  })

  tpl.clauses.forEach((cl, i) => {
    // Override key "i" replaces the whole clause text
    const mainText = overrides[String(i)] ?? cl.text
    out.push({
      text: [
        { text: `ข้อ ${i + 1}. `, bold: true, color: C.brand },
        ...htmlToInlineParts(renderTemplateText(mainText, ctx)),
      ],
      alignment: 'justify',
      margin: [0, 0, 0, 5] as [number, number, number, number],
    } as Content)
    ;(cl.sub ?? []).forEach((sub, j) => {
      // Override key "i.j" replaces a sub-clause
      const subText = overrides[`${i}.${j}`] ?? sub
      out.push({
        text: [
          { text: `${i + 1}.${j + 1} `, bold: true, color: C.brand },
          ...htmlToInlineParts(renderTemplateText(subText, ctx)),
        ],
        alignment: 'justify',
        fontSize: 12,
        margin: [22, 0, 0, 4] as [number, number, number, number],
      } as Content)
    })
  })

  out.push({
    text: htmlToInlineParts(renderTemplateText(tpl.closing, ctx)),
    alignment: 'justify',
    margin: [0, 10, 0, 0] as [number, number, number, number],
  })

  return out
}

/** Signature block (line + name + role + date placeholder) */
function signatureBlock(opts: {
  label: string
  name?: string
  signerLine?: string
}): Content {
  return {
    stack: [
      { text: '', margin: [0, 26, 0, 0] as [number, number, number, number] },
      {
        canvas: [
          {
            type: 'line',
            x1: 20,
            y1: 0,
            x2: 200,
            y2: 0,
            lineWidth: 0.6,
            lineColor: C.brand,
          },
        ],
      },
      {
        text: opts.name?.trim() || '..............................',
        alignment: 'center',
        bold: true,
        color: C.brand,
        fontSize: 12,
        margin: [0, 4, 0, 0] as [number, number, number, number],
      },
      ...(opts.signerLine
        ? ([
            {
              text: opts.signerLine,
              alignment: 'center',
              italics: true,
              color: C.inkSoft,
              fontSize: 10,
            },
          ] as Content[])
        : []),
      {
        text: opts.label,
        alignment: 'center',
        color: C.inkSoft,
        fontSize: 10,
        margin: [0, 1, 0, 0] as [number, number, number, number],
      },
      {
        text: '(......./......./........)',
        alignment: 'center',
        color: C.inkFaint,
        fontSize: 9,
        margin: [0, 2, 0, 0] as [number, number, number, number],
      },
    ],
  }
}

/** Main parties + witness signatures (2x2 grid) */
function mainSignatures(refs: Refs): Content {
  const c = refs.contract.data
  const landlordName = refs.landlord?.data?.name ?? c.landlord ?? ''
  const landlordIsCompany = refs.landlord?.data?.partyType === 'company'
  const landlordSigner = landlordIsCompany ? refs.landlord?.data?.signerName : undefined
  const landlordSignerTitle = landlordIsCompany
    ? refs.landlord?.data?.signerTitle
    : undefined
  const landlordSignerLine =
    landlordSigner
      ? `โดย ${landlordSigner}${landlordSignerTitle ? ` (${landlordSignerTitle})` : ''}`
      : undefined

  const tenantName = refs.tenant?.data?.name ?? c.tenant ?? ''
  const tenantIsCompany = refs.tenant?.data?.partyType === 'company'
  const tenantSigner = tenantIsCompany
    ? refs.tenant?.data?.signerName ?? (c.tenantSignerName as string | undefined)
    : undefined
  const tenantSignerTitle = tenantIsCompany
    ? refs.tenant?.data?.signerTitle ?? (c.tenantSignerTitle as string | undefined)
    : undefined
  const tenantSignerLine = tenantSigner
    ? `โดย ${tenantSigner}${tenantSignerTitle ? ` (${tenantSignerTitle})` : ''}`
    : undefined

  const wit1 = (c.wit1 as string | undefined) ?? ''
  const wit2 = (c.wit2 as string | undefined) ?? ''

  return {
    unbreakable: true,
    stack: [
      sectionBar('ลายมือชื่อคู่สัญญาและพยาน', 'SIGNATURES'),
      {
        columns: [
          signatureBlock({
            label: 'ผู้ให้เช่า · LESSOR',
            name: landlordName,
            signerLine: landlordSignerLine,
          }),
          signatureBlock({
            label: 'ผู้เช่า · LESSEE',
            name: tenantName,
            signerLine: tenantSignerLine,
          }),
        ],
        columnGap: 24,
        margin: [0, 10, 0, 0] as [number, number, number, number],
      },
      {
        columns: [
          signatureBlock({ label: 'พยาน · WITNESS 1', name: wit1 }),
          signatureBlock({ label: 'พยาน · WITNESS 2', name: wit2 }),
        ],
        columnGap: 24,
        margin: [0, 14, 0, 0] as [number, number, number, number],
      },
    ],
  }
}

/* ─────────── appendix (page 2) ─────────── */

function kvRow(k: string, v: string): unknown[] {
  return [
    { text: k, color: C.inkSoft, fontSize: 11, margin: [0, 0, 0, 0] },
    { text: v, color: C.ink, fontSize: 11, margin: [0, 0, 0, 0] },
  ]
}

function kvTable(rows: unknown[][]): Content {
  return {
    table: {
      widths: [130, '*'],
      body: rows as Content[][],
    },
    layout: {
      hLineColor: () => C.ruleSoft,
      vLineColor: () => C.ruleSoft,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      fillColor: (i: number) => (i % 2 === 1 ? C.bgFainter : null),
      paddingTop: () => 7,
      paddingBottom: () => 7,
      paddingLeft: () => 12,
      paddingRight: () => 12,
    },
    margin: [0, 0, 0, 6] as [number, number, number, number],
  }
}

function appendixHeader(contractNo: string, madeDate: string): Content {
  return {
    stack: [
      {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: 495,
            h: 2.5,
            color: C.brand,
          },
        ],
        margin: [0, 0, 0, 6] as [number, number, number, number],
      },
      {
        text: 'SCHEDULE · เอกสารประกอบสัญญา',
        color: C.inkFaint,
        fontSize: 9,
        characterSpacing: 2,
      },
      {
        text: 'เอกสารแนบท้ายสัญญาเช่า',
        color: C.brand,
        bold: true,
        fontSize: 20,
        margin: [0, 2, 0, 0] as [number, number, number, number],
      },
      {
        text: [
          { text: 'Contract Details   ·   วันที่ทำสัญญา ', color: C.inkFaint, fontSize: 10 },
          { text: madeDate, color: C.brand, bold: true, fontSize: 11 },
          { text: '   ·   เลขที่ ', color: C.inkFaint, fontSize: 10 },
          { text: contractNo, color: C.brand, bold: true, fontSize: 11 },
        ],
        margin: [0, 4, 0, 14] as [number, number, number, number],
      },
    ],
    pageBreak: 'before',
  }
}

function appendixParties(refs: Refs): Content {
  return {
    stack: [
      sectionBar('คู่สัญญา', 'PARTIES'),
      partiesTable(refs),
    ],
  }
}

function appendixProperty(refs: Refs): Content {
  const c = refs.contract.data
  const p = refs.property?.data
  const rows: unknown[][] = []
  rows.push(kvRow('ทรัพย์สิน', p?.name?.trim() || (c.property as string) || '—'))
  if (c.purpose) rows.push(kvRow('วัตถุประสงค์การเช่า', String(c.purpose).trim()))
  if (p?.area?.trim()) rows.push(kvRow('พื้นที่', p.area.trim()))
  rows.push(kvRow('ที่อยู่', propertyAddress(refs.property)))
  if (p?.titleDeed?.trim()) rows.push(kvRow('เอกสารสิทธิ์', p.titleDeed.trim()))
  return {
    stack: [
      sectionBar('รายละเอียดทรัพย์สิน', 'PROPERTY'),
      kvTable(rows),
    ],
  }
}

function appendixLease(refs: Refs): Content {
  const c = refs.contract.data
  const rows: unknown[][] = []
  if (c.start?.trim()) rows.push(kvRow('วันเริ่มต้น', dateThaiLong(c.start)))
  if (c.end?.trim()) rows.push(kvRow('วันสิ้นสุด', dateThaiLong(c.end)))
  const durStr = String(c.dur ?? '').trim()
  if (durStr) {
    const hasUnit = /(ปี|เดือน|วัน)/.test(durStr)
    rows.push(kvRow('ระยะเวลา', hasUnit ? durStr : `${durStr} เดือน`))
  }
  if (c.rate != null && String(c.rate).trim() !== '') {
    rows.push(kvRow('อัตราค่าเช่า', fmtAmount(c.rate)))
  }
  if (c.payment?.trim()) rows.push(kvRow('วิธีชำระ', c.payment.trim()))
  if ((c as { rateAdj?: string }).rateAdj) {
    rows.push(kvRow('การปรับค่าเช่า', String((c as { rateAdj?: string }).rateAdj)))
  }
  if (c.deposit != null && String(c.deposit).trim() !== '' && Number(c.deposit) !== 0) {
    rows.push(kvRow('เงินประกัน', fmtAmount(c.deposit)))
  }
  return {
    stack: [
      sectionBar('ระยะเวลาและค่าเช่า', 'LEASE TERMS'),
      kvTable(rows),
    ],
  }
}

function appendixPayment(refs: Refs): Content | null {
  const b = refs.bank?.data
  if (!b) return null
  const rows: unknown[][] = []
  if (b.bank) {
    const branch = b.branch?.trim()
    rows.push(kvRow('ธนาคาร', branch ? `${b.bank} สาขา${branch}` : b.bank))
  }
  if (b.accountName?.trim()) rows.push(kvRow('ชื่อบัญชี', b.accountName.trim()))
  if (b.acctNo?.trim()) rows.push(kvRow('เลขที่บัญชี', b.acctNo.trim()))
  if ((b as { promptPayId?: string }).promptPayId)
    rows.push(kvRow('PromptPay', String((b as { promptPayId?: string }).promptPayId)))
  if (rows.length === 0) return null
  return {
    stack: [
      sectionBar('บัญชีรับโอน', 'PAYMENT ACCOUNT'),
      kvTable(rows),
    ],
  }
}

function appendixNotes(refs: Refs): Content | null {
  const notes = (refs.contract.data as { notes?: string }).notes?.trim()
  if (!notes) return null
  return {
    stack: [
      sectionBar('หมายเหตุ', 'NOTES'),
      {
        text: notes,
        color: C.ink,
        fontSize: 11,
        margin: [12, 8, 12, 8] as [number, number, number, number],
      },
    ],
  }
}

function appendixSignatures(refs: Refs): Content {
  const c = refs.contract.data
  const landlordName = refs.landlord?.data?.name ?? c.landlord ?? ''
  const landlordIsCompany = refs.landlord?.data?.partyType === 'company'
  const landlordSigner = landlordIsCompany ? refs.landlord?.data?.signerName : undefined
  const landlordSignerTitle = landlordIsCompany
    ? refs.landlord?.data?.signerTitle
    : undefined
  const landlordSignerLine = landlordSigner
    ? `โดย ${landlordSigner}${landlordSignerTitle ? ` (${landlordSignerTitle})` : ''}`
    : undefined

  const tenantName = refs.tenant?.data?.name ?? c.tenant ?? ''
  const tenantIsCompany = refs.tenant?.data?.partyType === 'company'
  const tenantSigner = tenantIsCompany
    ? refs.tenant?.data?.signerName ?? (c.tenantSignerName as string | undefined)
    : undefined
  const tenantSignerTitle = tenantIsCompany
    ? refs.tenant?.data?.signerTitle ?? (c.tenantSignerTitle as string | undefined)
    : undefined
  const tenantSignerLine = tenantSigner
    ? `โดย ${tenantSigner}${tenantSignerTitle ? ` (${tenantSignerTitle})` : ''}`
    : undefined

  return {
    unbreakable: true,
    stack: [
      sectionBar('ลายมือชื่อคู่สัญญา', 'SIGNATURES'),
      {
        columns: [
          signatureBlock({
            label: 'ผู้ให้เช่า · LESSOR',
            name: landlordName,
            signerLine: landlordSignerLine,
          }),
          signatureBlock({
            label: 'ผู้เช่า · LESSEE',
            name: tenantName,
            signerLine: tenantSignerLine,
          }),
        ],
        columnGap: 24,
        margin: [0, 10, 0, 0] as [number, number, number, number],
      },
    ],
  }
}

/* ─────────── main builder ─────────── */

export function buildContractPdf(refs: Refs): TDocumentDefinitions {
  const c = refs.contract.data
  const contractNo = (c.no ?? '').trim() || `#${refs.contract.id}`
  const madeDate = dateBE(c.madeDate)
  const tenantName = refs.tenant?.data?.name ?? c.tenant ?? '—'
  const propName = refs.property?.data?.name?.trim() ?? '—'

  return {
    info: {
      title: `สัญญาเช่า ${contractNo}`,
      author: 'SN Real Estate',
      subject: `${tenantName} เช่า ${propName}`,
    },
    pageSize: 'A4',
    pageMargins: [50, 56, 50, 50] as [number, number, number, number],

    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null
      return {
        margin: [50, 22, 50, 0] as [number, number, number, number],
        columns: [
          {
            text: `สัญญาเช่า ${contractNo}`,
            fontSize: 9,
            color: C.inkFaint,
          },
          {
            text: `หน้า ${currentPage}/${pageCount}`,
            alignment: 'right',
            fontSize: 9,
            color: C.inkFaint,
          },
        ],
      }
    },

    footer: (currentPage: number, pageCount: number) => ({
      text: `หน้า ${currentPage} จาก ${pageCount}`,
      alignment: 'center',
      fontSize: 9,
      color: C.inkFaint,
      margin: [0, 16, 0, 0] as [number, number, number, number],
    }),

    content: [
      /* ────── PAGE 1 : สัญญาหลัก ────── */
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 495, h: 2.5, color: C.brand },
        ],
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      {
        columns: [
          {
            stack: [
              {
                text: 'สัญญาเช่า',
                bold: true,
                color: C.brand,
                fontSize: 22,
              },
              {
                text: 'TENANCY AGREEMENT',
                color: C.inkFaint,
                fontSize: 9,
                characterSpacing: 2,
                margin: [0, 1, 0, 0] as [number, number, number, number],
              },
            ],
          },
          {
            width: 'auto',
            stack: [
              {
                text: 'เลขที่สัญญา · No.',
                alignment: 'right',
                color: C.inkFaint,
                fontSize: 8,
                characterSpacing: 1,
              },
              {
                text: contractNo,
                alignment: 'right',
                bold: true,
                color: C.brand,
                fontSize: 14,
                margin: [0, 1, 0, 0] as [number, number, number, number],
              },
            ],
          },
        ],
        margin: [0, 6, 0, 12] as [number, number, number, number],
      },
      dateStrip(refs),
      sectionBar('คู่สัญญา', 'PARTIES TO AGREEMENT'),
      partiesTable(refs),
      ...clausesBody(refs),
      mainSignatures(refs),

      /* ────── PAGE 2 : เอกสารแนบท้าย ────── */
      appendixHeader(contractNo, madeDate),
      appendixParties(refs),
      appendixProperty(refs),
      appendixLease(refs),
      ...((): Content[] => {
        const pay = appendixPayment(refs)
        return pay ? [pay] : []
      })(),
      ...((): Content[] => {
        const n = appendixNotes(refs)
        return n ? [n] : []
      })(),
      appendixSignatures(refs),
    ],

    defaultStyle: {
      font: 'THSarabunNew',
      fontSize: 13,
      lineHeight: 1.35,
      color: C.ink,
    },
  }
}
