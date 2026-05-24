/**
 * Build contract print HTML — ported from v1 modules/17-contract-print.js
 *
 * Returns a complete HTML document as a string, designed to be loaded into
 * an iframe via srcdoc. The HTML embeds @media print CSS so browser handles
 * pagination natively (window.print() inside the iframe).
 *
 * Visual is faithful to v1: Sarabun + navy #1e3a5f + sectioned appendix.
 */

import type { BankAccount } from '@/features/bank-accounts/types'
import type { Contract } from '@/features/contracts/types'
import type { Landlord } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'
import type { ContractTemplate } from '@/features/templates/types'
import { amt, parseAmt, spellAmt } from '@/lib/thai'
import { parseBE } from '@/lib/thai/date'
import { DEFAULT_TEMPLATE, renderTemplateText } from './default-template'

export type ContractHtmlRefs = {
  contract: Contract
  tenant?: Tenant | null
  landlord?: Landlord | null
  property?: Property | null
  bank?: BankAccount | null
  parent?: Contract | null
  template?: ContractTemplate | null
}

export type BuildContractHtmlOptions = {
  /** Embed inside iframe (adds body.embed for screen cards) */
  embed?: boolean
  /** Hide the floating print/close toolbar (default: hidden when embed=true) */
  hideToolbar?: boolean
}

const TH_MONTHS = [
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

function dateToThai(beStr: string | undefined | null): string {
  if (!beStr) return '-'
  const d = parseBE(beStr)
  if (!d) return beStr
  const jsDate = d.toDate()
  return `${jsDate.getDate()} ${TH_MONTHS[jsDate.getMonth()]} ${jsDate.getFullYear() + 543}`
}

const COMPANY_PREFIXES = [
  'บริษัท',
  'ห้างหุ้นส่วนจำกัด',
  'ห้างหุ้นส่วนสามัญ',
  'บมจ.',
  'บจก.',
  'หจก.',
  'หสน.',
  'Co.',
  'Ltd.',
  'Inc.',
  'LLC',
]

function isCompanyName(name: string | undefined | null): boolean {
  if (!name) return false
  return COMPANY_PREFIXES.some((p) => String(name).includes(p))
}

const NAME_PREFIXES = [
  'นาย',
  'นาง',
  'นางสาว',
  'น.ส.',
  'ดร.',
  'ผศ.',
  'รศ.',
  'ศ.',
  'พล.ต.',
  'พ.อ.',
  'พ.ต.',
  'ร.อ.',
  'Mr.',
  'Mrs.',
  'Ms.',
  'Miss',
  'Dr.',
]

function hasPrefix(name: string): boolean {
  const t = name.trim()
  return NAME_PREFIXES.some((p) => t.startsWith(p) || t.includes(p))
}

function withPrefix(name: string | undefined | null): string {
  if (!name) return ''
  const t = String(name).trim()
  if (!t) return ''
  if (hasPrefix(t)) return t
  const fb = /^[A-Za-z]/.test(t) ? 'Mr.' : 'นาย'
  return fb + (fb.endsWith('.') ? ' ' : '') + t
}

function fmtDeposit(raw: number | string | undefined | null): string {
  if (raw == null || raw === '') return ''
  const num = typeof raw === 'number' ? raw : parseAmt(String(raw))
  if (!Number.isFinite(num) || num === 0) return ''
  return `${amt(num, { symbol: false, decimal: 0 })} บาท (${spellAmt(num)})`
}

function fmtAmt(raw: number | string | undefined | null): string {
  if (raw == null || raw === '') return ''
  const num = typeof raw === 'number' ? raw : parseAmt(String(raw))
  if (!Number.isFinite(num)) return ''
  return `${amt(num, { symbol: false, decimal: 0 })} บาท`
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

function landlordAddress(l: Landlord | null | undefined, fallback?: string): string {
  if (l) {
    const built = buildAddress({
      addrLine: l.data?.addrLine,
      addrSubdistrict: l.data?.addrSubdistrict,
      addrDistrict: l.data?.addrDistrict,
      addrProvince: l.data?.addrProvince,
      addrPostal: l.data?.addrPostal,
    })
    if (built) return built
  }
  return (fallback ?? '').trim()
}

function tenantAddress(t: Tenant | null | undefined, fallback?: string): string {
  if (t) {
    const built = buildAddress({
      addrLine: t.data?.addrLine,
      addrSubdistrict: t.data?.addrSubdistrict,
      addrDistrict: t.data?.addrDistrict,
      addrProvince: t.data?.addrProvince,
      addrPostal: t.data?.addrPostal,
    })
    if (built) return built
  }
  return (fallback ?? '').trim()
}

function propertyAddress(p: Property | null | undefined): string {
  if (!p) return ''
  return buildAddress({
    addrLine: p.data?.addr_line,
    addrSubdistrict: p.data?.addr_subdistrict,
    addrDistrict: p.data?.addr_district,
    addrProvince: p.data?.addr_province ?? p.data?.province,
    addrPostal: p.data?.addr_postal,
  })
}

function escape(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// renderTemplateText returns HTML with <strong> tags — those should NOT be
// escaped in the print HTML (they're meaningful markup). escape() is for
// raw user data (party names, addresses, notes).

function sigBox(opts: {
  label: string
  name?: string
  title?: string
}): string {
  const safeName = opts.name ? escape(opts.name) : '...................................'
  return (
    '<div class="sig-block">' +
    '<div class="sig-img-area"><div style="width:160px"></div></div>' +
    '<div class="sig-line-rule"></div>' +
    `<div class="sig-name">${safeName}</div>` +
    (opts.title ? `<div class="sig-role">(${escape(opts.title)})</div>` : '') +
    `<div class="sig-role">${escape(opts.label)}</div>` +
    '<div class="sig-date">(......../......../........)</div>' +
    '</div>'
  )
}

function sigBoxParty(opts: {
  label: string
  partyName: string
  signerName?: string
  signerTitle?: string
}): string {
  if (isCompanyName(opts.partyName) && opts.signerName) {
    return (
      '<div class="sig-block">' +
      '<div class="sig-img-area"><div style="width:160px"></div></div>' +
      '<div class="sig-line-rule"></div>' +
      `<div class="sig-name" style="font-weight:600">${escape(opts.partyName)}</div>` +
      `<div class="sig-name" style="font-size:11px">โดย ${escape(withPrefix(opts.signerName))}</div>` +
      (opts.signerTitle
        ? `<div class="sig-role">(${escape(opts.signerTitle)})</div>`
        : '') +
      `<div class="sig-role">${escape(opts.label)}</div>` +
      '<div class="sig-date">(......../......../........)</div>' +
      '</div>'
    )
  }
  return sigBox({
    label: opts.label,
    name: withPrefix(opts.signerName || opts.partyName),
    title: opts.signerTitle,
  })
}

export function buildContractHtml(
  refs: ContractHtmlRefs,
  opts: BuildContractHtmlOptions = {},
): string {
  const { embed = true, hideToolbar = embed } = opts
  const c = refs.contract.data
  const today = new Date()

  // ── Names + addresses (prefer FK entity over inline string) ──
  const landlordName = (refs.landlord?.data?.name ?? c.landlord ?? '').trim()
  const tenantName = (refs.tenant?.data?.name ?? c.tenant ?? '').trim()
  const lAddr = landlordAddress(refs.landlord, c.landlordAddr)
  const tAddr = tenantAddress(refs.tenant, c.tenantAddr)
  const phone = refs.tenant?.data?.phone ?? ''
  const taxId = refs.tenant?.data?.taxId ?? c.taxId ?? ''

  // ── Signer info ──
  const landlordSigner = refs.landlord?.data?.signerName
  const landlordSignerTitle = refs.landlord?.data?.signerTitle
  const tenantSigner =
    refs.tenant?.data?.signerName ?? (c.tenantSignerName as string | undefined)
  const tenantSignerTitle =
    refs.tenant?.data?.signerTitle ?? (c.tenantSignerTitle as string | undefined)

  // ── Doc title (used by browser for "Save as PDF" filename) ──
  const tenantShort = tenantName
    .replace(/บริษัท\s*/g, 'บจก.')
    .replace(/\s*จำกัด/g, '')
    .replace(/\s*โดย.+/, '')
    .trim()
    .substring(0, 40)
  const docTitle = `สัญญาเช่า ${c.no || ''} ${tenantShort}`.trim()

  // ── ทำสัญญาที่ + วันที่ ──
  const madeAtRaw = (c.madeAt ?? '').trim()
  const madeAtFull = (() => {
    if (madeAtRaw && lAddr && !madeAtRaw.includes('ต.') && !madeAtRaw.includes('อ.')) {
      return `${madeAtRaw} (ที่อยู่: ${lAddr})`
    }
    if (madeAtRaw) return madeAtRaw
    if (lAddr) return lAddr
    return '-'
  })()
  const madeDateStr = dateToThai(c.madeDate)

  // ── Template + clauses + overrides ──
  const tpl = refs.template?.data
    ? {
        intro: refs.template.data.intro ?? DEFAULT_TEMPLATE.intro,
        clauses: refs.template.data.clauses ?? DEFAULT_TEMPLATE.clauses,
        closing: refs.template.data.closing ?? DEFAULT_TEMPLATE.closing,
      }
    : DEFAULT_TEMPLATE
  const ctx = { landlord: landlordName, tenant: tenantName }
  const overrides = (c.clauseOverrides ?? {}) as Record<string, string>

  // ── Property + bank (appendix) ──
  const p = refs.property?.data
  const b = refs.bank?.data

  // ════════ HTML build ════════
  const head =
    '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">' +
    `<title>${escape(docTitle)}</title>` +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">' +
    `<style>${CONTRACT_CSS}</style></head>`

  const bodyOpen = embed ? '<body class="embed">' : '<body>'

  const toolbar = hideToolbar
    ? ''
    : `<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:100;background:#1e3a5f;padding:10px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,0.25)">
       <button onclick="window.print()" style="background:#3b82f6;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨️ พิมพ์ / บันทึก PDF</button>
       <button onclick="window.close()" style="background:transparent;color:#94a3b8;border:1px solid #475569;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;font-family:Sarabun">ปิด</button>
       <span style="color:#94a3b8;font-size:12px;margin-left:auto">สัญญาเช่า — ${today.toLocaleDateString('th-TH')}</span>
       </div><div style="height:56px" class="no-print"></div>`

  // ─── Page 1: Main contract ───
  const page1Header =
    '<div class="c-header">' +
    '<div class="c-header-center">' +
    '<div class="c-title">สัญญาเช่า</div>' +
    '<div class="c-subtitle">Tenancy Agreement</div>' +
    '</div>' +
    '<div class="c-meta-badge"><span class="label">เลขที่สัญญา</span>' +
    `<span class="value">${escape(c.no ?? '')}</span></div>` +
    '</div>'

  const dateStrip =
    '<div class="c-date-strip">' +
    `ทำสัญญา ณ <b>${escape(madeAtFull)}</b><br>` +
    `เมื่อวันที่ <b>${escape(madeDateStr)}</b>` +
    '</div>'

  const partiesTable =
    '<table class="parties-table">' +
    '<tr class="sect-hdr"><td colspan="2">คู่สัญญา &nbsp;·&nbsp; Parties to Agreement</td></tr>' +
    '<tr class="party-row">' +
    '<td style="width:50%;border-right:1px solid #e2e8f0"><div class="party-cell">' +
    '<div class="party-label">ผู้ให้เช่า · Lessor</div>' +
    `<div class="party-name">${escape(landlordName)}</div>` +
    (lAddr
      ? `<div class="party-detail"><span class="party-detail-label">ที่อยู่:</span> ${escape(lAddr)}</div>`
      : '') +
    '</div></td>' +
    '<td><div class="party-cell">' +
    '<div class="party-label">ผู้เช่า · Lessee</div>' +
    `<div class="party-name">${escape(tenantName)}</div>` +
    (tAddr
      ? `<div class="party-detail"><span class="party-detail-label">ที่อยู่:</span> ${escape(tAddr)}</div>`
      : '') +
    (phone || taxId
      ? '<div class="party-detail">' +
        (phone ? `<span class="party-detail-label">โทร:</span> ${escape(phone)}` : '') +
        (phone && taxId ? ' &nbsp;·&nbsp; ' : '') +
        (taxId
          ? `<span class="party-detail-label">เลขผู้เสียภาษี:</span> ${escape(taxId)}`
          : '') +
        '</div>'
      : '') +
    '</div></td></tr>' +
    '</table>'

  // ── Body: intro + clauses + closing (with override marks) ──
  const clausesHtml = tpl.clauses
    .map((cl, i) => {
      const overrideKey = String(i)
      const isMainOverridden = overrideKey in overrides
      const mainText = isMainOverridden
        ? renderTemplateText(overrides[overrideKey] ?? '', ctx)
        : renderTemplateText(cl.text ?? '', ctx)
      const mainCls = isMainOverridden ? 'clause override-mark' : 'clause'
      const note = isMainOverridden
        ? '<span class="override-note">(แก้ไขเฉพาะสัญญานี้)</span>'
        : ''
      let html =
        `<div class="${mainCls}"><span class="clause-num">ข้อ ${i + 1}.</span> ${mainText}${note}</div>`
      if (cl.sub?.length) {
        html += cl.sub
          .map((s, j) => {
            const subKey = `${i}.${j}`
            const isSubOverridden = subKey in overrides
            const subText = isSubOverridden
              ? renderTemplateText(overrides[subKey] ?? '', ctx)
              : renderTemplateText(s, ctx)
            const subCls = isSubOverridden ? 'sub-clause override-mark' : 'sub-clause'
            const subNote = isSubOverridden ? '<span class="override-note">(แก้ไข)</span>' : ''
            return `<div class="${subCls}"><span class="sub-clause-num">${i + 1}.${j + 1}</span> ${subText}${subNote}</div>`
          })
          .join('')
      }
      return html
    })
    .join('')

  const body =
    '<div class="c-body">' +
    `<p class="c-intro">${renderTemplateText(tpl.intro, ctx)}</p>` +
    clausesHtml +
    (tpl.closing ? `<p class="c-closing">${renderTemplateText(tpl.closing, ctx)}</p>` : '') +
    '</div>'

  // ── Signatures ──
  const sigsMain =
    '<div class="sig-section">' +
    '<div class="sig-section-title">ลายมือชื่อคู่สัญญาและพยาน / Signatures</div>' +
    '<div class="sig-grid">' +
    sigBoxParty({
      label: 'ผู้ให้เช่า (Lessor)',
      partyName: landlordName,
      signerName: landlordSigner,
      signerTitle: landlordSignerTitle,
    }) +
    sigBoxParty({
      label: 'ผู้เช่า (Lessee)',
      partyName: tenantName,
      signerName: tenantSigner,
      signerTitle: tenantSignerTitle,
    }) +
    '</div>' +
    '<div class="sig-grid">' +
    sigBox({ label: 'พยาน / Witness 1', name: withPrefix(c.wit1) }) +
    sigBox({ label: 'พยาน / Witness 2', name: withPrefix(c.wit2) }) +
    '</div>' +
    '</div>'

  const page1 =
    '<div class="page">' +
    page1Header +
    dateStrip +
    partiesTable +
    '<div class="page-body">' +
    body +
    sigsMain +
    '</div></div>'

  // ─── Page 2: Appendix ───
  const appendixHeader =
    '<div class="c-header appendix-banner">' +
    '<div class="c-header-center">' +
    '<div class="appendix-eyebrow">SCHEDULE · เอกสารประกอบสัญญา</div>' +
    '<div class="c-title">เอกสารแนบท้ายสัญญาเช่า</div>' +
    `<div class="c-subtitle">Contract Details &nbsp;·&nbsp; วันที่ทำสัญญา <b>${escape(madeDateStr)}</b></div>` +
    '</div>' +
    `<div class="c-meta-badge"><span class="label">เลขที่สัญญา</span><span class="value">${escape(c.no ?? '')}</span></div>` +
    '</div>'

  // Helpers for appendix
  const row = (label: string, value: string | undefined | null): string =>
    value ? `<tr><td class="k">${escape(label)}</td><td class="v">${escape(value)}</td></tr>` : ''
  const section = (thai: string, en: string, inner: string): string =>
    inner
      ? '<div class="ap-section">' +
        `<div class="ap-section-bar">${escape(thai)}<span class="en">· ${escape(en)}</span></div>` +
        inner +
        '</div>'
      : ''

  // Parties (2-col)
  const partyDetail = (k: string, v: string | undefined | null): string =>
    v ? `<div class="ap-party-detail"><span class="k">${escape(k)}:</span> ${escape(v)}</div>` : ''
  const partiesInner =
    '<table class="ap-parties"><tr>' +
    '<td>' +
    '<div class="ap-party-label">ผู้ให้เช่า · Lessor</div>' +
    `<div class="ap-party-name">${escape(landlordName)}</div>` +
    partyDetail('ที่อยู่', lAddr) +
    partyDetail('โทรศัพท์', refs.landlord?.data?.phone) +
    partyDetail('เลขผู้เสียภาษี', refs.landlord?.data?.taxId) +
    '</td>' +
    '<td>' +
    '<div class="ap-party-label">ผู้เช่า · Lessee</div>' +
    `<div class="ap-party-name">${escape(tenantName)}</div>` +
    partyDetail('ที่อยู่', tAddr) +
    partyDetail('โทรศัพท์', phone) +
    partyDetail('เลขผู้เสียภาษี', taxId) +
    '</td>' +
    '</tr></table>'
  const partiesSection = section('คู่สัญญา', 'PARTIES', partiesInner)

  // Property
  const propAddr = propertyAddress(refs.property)
  const propertyRows =
    row('ทรัพย์สิน', p?.name ?? (c.property as string | undefined)) +
    row('วัตถุประสงค์การเช่า', c.purpose as string | undefined) +
    row('ที่อยู่', propAddr) +
    row('พื้นที่', p?.area) +
    row('เอกสารสิทธิ์', p?.titleDeed)
  const propertySection = section(
    'รายละเอียดทรัพย์สิน',
    'PROPERTY',
    propertyRows ? `<table class="ap-table">${propertyRows}</table>` : '',
  )

  // Lease terms
  const durStr = (() => {
    const d = String(c.dur ?? '').trim()
    if (!d) return ''
    return /(ปี|เดือน|วัน)/.test(d) ? d : `${d} เดือน`
  })()
  const leaseRows =
    row('วันเริ่มต้น', c.start ? dateToThai(c.start) : '') +
    row('วันสิ้นสุด', c.end ? dateToThai(c.end) : '') +
    row('ระยะเวลา', durStr) +
    row('อัตราค่าเช่า', fmtAmt(c.rate)) +
    row('วิธีชำระ', c.payment) +
    row('การปรับค่าเช่า', (c as { rateAdj?: string }).rateAdj) +
    row('เงินประกัน', fmtDeposit(c.deposit))
  const leaseSection = section(
    'ระยะเวลาและค่าเช่า',
    'LEASE TERMS',
    leaseRows ? `<table class="ap-table">${leaseRows}</table>` : '',
  )

  // Bank
  const bankRows = b
    ? row('ธนาคาร', b.bank ? (b.branch ? `${b.bank} สาขา${b.branch}` : b.bank) : '') +
      row('ชื่อบัญชี', b.accountName) +
      row('เลขที่บัญชี', b.acctNo) +
      row('PromptPay', (b as { promptPayId?: string }).promptPayId)
    : ''
  const bankSection = section(
    'บัญชีรับโอน',
    'PAYMENT ACCOUNT',
    bankRows ? `<table class="ap-table">${bankRows}</table>` : '',
  )

  // Notes
  const notesText = (c as { notes?: string }).notes?.trim()
  const notesSection = section(
    'หมายเหตุ',
    'NOTES',
    notesText ? `<div class="ap-notes-text">${escape(notesText)}</div>` : '',
  )

  // Appendix signatures (no witnesses on appendix per v1)
  const sigsAppendix =
    '<div class="sig-section">' +
    '<div class="sig-section-title">ลายมือชื่อคู่สัญญา / Signatures</div>' +
    '<div class="sig-grid">' +
    sigBoxParty({
      label: 'ผู้ให้เช่า (Lessor)',
      partyName: landlordName,
      signerName: landlordSigner,
      signerTitle: landlordSignerTitle,
    }) +
    sigBoxParty({
      label: 'ผู้เช่า (Lessee)',
      partyName: tenantName,
      signerName: tenantSigner,
      signerTitle: tenantSignerTitle,
    }) +
    '</div></div>'

  const page2 =
    '<div class="page appendix-page">' +
    appendixHeader +
    '<div class="page-body">' +
    partiesSection +
    propertySection +
    leaseSection +
    bankSection +
    notesSection +
    sigsAppendix +
    '</div></div>'

  return head + bodyOpen + toolbar + page1 + page2 + '</body></html>'
}

/* ─────────── CSS (verbatim port from v1 modules/17-contract-print.js) ─────────── */
const CONTRACT_CSS = `
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Sarabun', sans-serif; }
body { background: #fff; color: #1a202c; }
.page { width: 210mm; padding: 18mm 22mm 18mm; margin: 0 auto; position: relative; page-break-after: always; }
.page:last-child { page-break-after: auto; }

.c-header { border-top: 3px solid #1e3a5f; border-bottom: 1px solid #cbd5e1; padding: 12px 0 10px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.c-header-center { flex: 1; }
.c-title { font-size: 20px; font-weight: 800; color: #1e3a5f; letter-spacing: .3px; line-height: 1.15; }
.c-subtitle { font-size: 9px; color: #94a3b8; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; margin-top: 3px; }
.c-meta-badge { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 3px solid #1e3a5f; border-radius: 4px; padding: 6px 12px; text-align: left; white-space: nowrap; min-width: 120px; }
.c-meta-badge .label { color: #94a3b8; font-size: 8px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
.c-meta-badge .value { color: #1e3a5f; font-weight: 700; font-size: 12px; display: block; margin-top: 1px; font-variant-numeric: tabular-nums; }

.c-date-strip { background: #f8fafc; border-left: 3px solid #94a3b8; padding: 8px 14px; font-size: 12px; color: #334155; margin-bottom: 16px; line-height: 1.55; }
.c-date-strip b { color: #1e3a5f; font-weight: 700; }

.parties-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; }
.parties-table .sect-hdr td { background: #f1f5f9; color: #1e3a5f; padding: 6px 14px; font-size: 9.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
.parties-table .party-row td { padding: 0; vertical-align: top; }
.party-cell { padding: 11px 14px; border-right: 1px solid #e2e8f0; }
.party-cell:last-child { border-right: none; }
.party-label { font-size: 8px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; }
.party-name { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; line-height: 1.35; }
.party-detail { font-size: 11px; color: #1e293b; line-height: 1.55; margin-top: 2px; }
.party-detail-label { color: #64748b; font-weight: 600; font-size: 9.5px; letter-spacing: .3px; }

.c-body { font-size: 11.5px; line-height: 1.65; color: #1e293b; text-align: justify; margin-bottom: 14px; }
.c-intro { margin: 0 0 12px 0; text-indent: 24px; }
.clause { margin: 12px 0; padding-left: 0; }
.clause-num { font-weight: 700; color: #1e3a5f; font-size: 12px; margin-right: 4px; }
.sub-clause { margin: 8px 0 8px 28px; font-size: 11px; color: #1e293b; line-height: 1.65; }
.sub-clause-num { font-weight: 600; color: #1e3a5f; margin-right: 4px; }
.c-closing { margin: 16px 0 0 0; text-indent: 24px; }
.override-mark { color: #dc2626; }
.override-note { font-size: 9px; color: #dc2626; font-style: italic; margin-left: 6px; }
@media print { .override-mark { color: inherit !important; } .override-note { display: none !important; } }

.c-divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }

/* Sig ติดต่อจาก closing · ไม่ force หน้าแยก · ทั้งสัญญา (clauses + sig) อยู่ใน 2 หน้า */
.sig-section { margin-top: 28px; padding-top: 12px; page-break-inside: avoid; break-inside: avoid; }
.sig-section-title { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; text-align: center; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
.sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px; }
.sig-grid:last-child { margin-bottom: 0; }
.sig-block { text-align: center; }
.sig-img-area { height: 44px; display: flex; align-items: flex-end; justify-content: center; }
.sig-img-area img { max-height: 50px; max-width: 145px; object-fit: contain; }
.sig-section-title + .sig-grid .sig-img-area { height: 72px; }
.sig-line-rule { border-top: 1px solid #1e3a5f; margin: 4px auto 0; width: 170px; }
.sig-name { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-top: 5px; }
.sig-role { font-size: 11.5px; color: #475569; margin-top: 1px; }
.sig-date { font-size: 11px; color: #64748b; margin-top: 3px; }

.c-header.appendix-banner { border-top: 3px solid #1e3a5f; border-bottom: 1px solid #cbd5e1; padding: 12px 0 10px; margin-bottom: 18px; }
.appendix-eyebrow { font-size: 9px; letter-spacing: 3px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }

.ap-section { margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; }
.ap-section-bar { background: #f1f5f9; color: #1e3a5f; padding: 6px 12px; font-size: 10.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px 4px 0 0; border-bottom: 1px solid #cbd5e1; }
.ap-section-bar .en { color: #64748b; font-weight: 500; margin-left: 8px; font-size: 9px; letter-spacing: 1.5px; }

.ap-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 4px 4px; overflow: hidden; }
.ap-table tr { border-bottom: 1px solid #f1f5f9; }
.ap-table tr:last-child { border-bottom: none; }
.ap-table tr:nth-child(even) { background: #fafbfc; }
.ap-table td { padding: 8px 14px; font-size: 12.5px; color: #1e293b; line-height: 1.6; vertical-align: top; }
.ap-table td.k { width: 38%; color: #475569; font-weight: 600; font-size: 11.5px; letter-spacing: .2px; }
.ap-table td.v strong { color: #1e3a5f; font-weight: 700; }

.ap-parties { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 4px 4px; }
.ap-parties td { padding: 12px 14px; vertical-align: top; width: 50%; border-right: 1px solid #e2e8f0; }
.ap-parties td:last-child { border-right: none; }
.ap-party-label { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px; }
.ap-party-name { font-size: 14px; font-weight: 700; color: #1e3a5f; margin-bottom: 5px; line-height: 1.35; }
.ap-party-detail { font-size: 12px; color: #1e293b; line-height: 1.6; margin-top: 3px; }
.ap-party-detail .k { color: #64748b; font-weight: 600; font-size: 10px; letter-spacing: .3px; }

.ap-notes-text { padding: 12px 14px; font-size: 12.5px; color: #1e293b; line-height: 1.7; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 4px 4px; }

@media print {
  @page { size: A4; margin: 16mm 20mm 16mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; orphans: 3; widows: 3; }
  .no-print { display: none !important; }
  .page { padding: 0 !important; min-height: 0 !important; height: auto !important; margin: 0; box-shadow: none; display: block; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page-body { display: block; }
  .sig-section { padding-top: 12px; }
  .clause, .sub-clause { page-break-inside: avoid; break-inside: avoid; orphans: 2; widows: 2; }
  .parties-table, .sig-grid, .sig-block, .ap-card, .sig-section { page-break-inside: avoid; break-inside: avoid; }
  .appendix-page { page-break-before: always; break-before: page; }
}
@media screen {
  body { background: #e2e8f0; padding: 20px; }
  .page { box-shadow: 0 4px 24px rgba(0,0,0,0.12); border-radius: 4px; margin-bottom: 24px; background: #fff; }
  body.embed { background: #e2e8f0; padding: 16px 0; }
  body.embed .page { width: 210mm; max-width: calc(100% - 20px); margin: 0 auto 24px; min-height: auto; padding: 12mm 18mm 12mm; box-shadow: 0 6px 20px rgba(0,0,0,0.10); border-radius: 4px; background: #fff; display: block; }
  body.embed .page-body { display: block; }
}
`
