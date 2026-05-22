/**
 * Contract PDF builder — pdfmake + Sarabun
 *
 * Lesson: ห้ามใช้ window.print() · ต้องใช้ pdfmake เพราะ:
 *  - Header repeat ทุกหน้า (pdfmake header callback)
 *  - ตัดหน้าคุม 100% (dontBreakRows + pageBreak)
 *  - Cross-browser identical
 *
 * Output: TDocumentDefinitions พร้อมใส่ usePdf() download/open
 */

import type { Content, TDocumentDefinitions } from '@/lib/pdf'
import type { BankAccount } from '@/features/bank-accounts/types'
import type { Contract } from '@/features/contracts/types'
import type { Landlord } from '@/features/landlords/types'
import type { Property } from '@/features/properties/types'
import type { Tenant } from '@/features/tenants/types'
import { fmtThaiLong } from '@/lib/thai'
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
}

function buildAddress(parts: {
  addrLine?: string
  addrSubdistrict?: string
  addrDistrict?: string
  addrProvince?: string
  addrPostal?: string
}): string {
  const out = [
    parts.addrLine,
    parts.addrSubdistrict && `ต.${parts.addrSubdistrict}`,
    parts.addrDistrict && `อ.${parts.addrDistrict}`,
    parts.addrProvince && `จ.${parts.addrProvince}`,
    parts.addrPostal,
  ]
    .filter(Boolean)
    .join(' ')
  return out.trim() || '-'
}

function landlordAddress(l: Landlord | null | undefined, fallback: string | undefined): string {
  if (!l) return (fallback ?? '').trim() || '-'
  return buildAddress({
    addrLine: l.data?.addrLine,
    addrSubdistrict: l.data?.addrSubdistrict,
    addrDistrict: l.data?.addrDistrict,
    addrProvince: l.data?.addrProvince,
    addrPostal: l.data?.addrPostal,
  })
}

function tenantAddress(t: Tenant | null | undefined, fallback: string | undefined): string {
  if (!t) return (fallback ?? '').trim() || '-'
  return buildAddress({
    addrLine: t.data?.addrLine,
    addrSubdistrict: t.data?.addrSubdistrict,
    addrDistrict: t.data?.addrDistrict,
    addrProvince: t.data?.addrProvince,
    addrPostal: t.data?.addrPostal,
  })
}

function propertyAddress(p: Property | null | undefined): string {
  if (!p) return '-'
  return buildAddress({
    addrLine: p.data?.addr_line,
    addrSubdistrict: p.data?.addr_subdistrict,
    addrDistrict: p.data?.addr_district,
    addrProvince: p.data?.addr_province ?? p.data?.province,
    addrPostal: p.data?.addr_postal,
  })
}

/**
 * Render contract body — intro + clauses (with sub-clauses) + closing.
 *
 * Uses the v1 default template (12 ข้อ + sub-clauses) ported verbatim to
 * `default-template.ts`. Variable placeholders ({{tenant}}, {{landlord}}) and
 * <strong> tags are processed via renderTemplateText + htmlToInlineParts so
 * the PDF looks like what users see in v1's print preview.
 *
 * Future: read active template from DB (template editor feature · task #16)
 * and apply per-contract clauseOverrides.
 */
function renderClauses(c: Contract): Content[] {
  const ctx = {
    landlord: (c.data.landlord ?? '').trim(),
    tenant: (c.data.tenant ?? '').trim(),
  }

  const out: Content[] = []

  // Intro paragraph
  const introHtml = renderTemplateText(DEFAULT_TEMPLATE.intro, ctx)
  out.push({
    text: htmlToInlineParts(introHtml),
    margin: [0, 0, 0, 10] as [number, number, number, number],
  })

  // Numbered clauses + sub-clauses
  DEFAULT_TEMPLATE.clauses.forEach((cl, i) => {
    const mainHtml = renderTemplateText(cl.text, ctx)
    out.push({
      text: [
        { text: `ข้อ ${i + 1}. `, bold: true, color: '#1e3a5f' },
        ...htmlToInlineParts(mainHtml),
      ],
      margin: [0, 0, 0, 6] as [number, number, number, number],
    } as Content)
    ;(cl.sub ?? []).forEach((sub, j) => {
      const subHtml = renderTemplateText(sub, ctx)
      out.push({
        text: [
          {
            text: `${i + 1}.${j + 1} `,
            bold: true,
            color: '#1e3a5f',
          },
          ...htmlToInlineParts(subHtml),
        ],
        fontSize: 10.5,
        margin: [24, 0, 0, 4] as [number, number, number, number],
      } as Content)
    })
  })

  // Closing paragraph
  const closingHtml = renderTemplateText(DEFAULT_TEMPLATE.closing, ctx)
  out.push({
    text: htmlToInlineParts(closingHtml),
    margin: [0, 12, 0, 0] as [number, number, number, number],
  })

  return out
}

function partyBlock(opts: {
  label: string
  name: string
  taxId?: string
  phone?: string
  address: string
  signerName?: string
  signerTitle?: string
  isCompany?: boolean
}): Content {
  const rows: Content[] = []
  rows.push({ text: opts.name, bold: true, fontSize: 12 })
  if (opts.taxId) rows.push({ text: `เลขผู้เสียภาษี ${opts.taxId}`, fontSize: 11 })
  if (opts.phone) rows.push({ text: `โทร ${opts.phone}`, fontSize: 11 })
  rows.push({ text: opts.address, fontSize: 11 })
  if (opts.isCompany && opts.signerName) {
    rows.push({ text: `โดย ${opts.signerName}${opts.signerTitle ? ` (${opts.signerTitle})` : ''}`, fontSize: 11, italics: true })
  }
  return {
    stack: rows,
    margin: [0, 0, 0, 0] as [number, number, number, number],
  }
}

/**
 * Main builder
 */
export function buildContractPdf(refs: Refs): TDocumentDefinitions {
  const c = refs.contract
  const d = c.data
  const contractNo = (d.no ?? '').trim() || `#${c.id}`
  const madeDate = d.madeDate?.trim() ? fmtThaiLong(parseBeToDate(d.madeDate)) : ''
  const madeAt = d.madeAt?.trim() || ''

  const landlordName = refs.landlord?.data?.name ?? d.landlord ?? '-'
  const landlordIsCompany = refs.landlord?.data?.partyType === 'company'
  const tenantName = refs.tenant?.data?.name ?? d.tenant ?? '-'
  const tenantIsCompany = refs.tenant?.data?.partyType === 'company'

  const propName = refs.property?.data?.name?.trim() ?? '-'
  const propAddr = propertyAddress(refs.property)
  const propTitleDeed = refs.property?.data?.titleDeed?.trim() ?? ''
  const propArea = refs.property?.data?.area?.trim() ?? ''

  return {
    info: {
      title: `สัญญาเช่า ${contractNo}`,
      author: 'SN Real Estate',
      subject: `${tenantName} เช่า ${propName}`,
    },
    pageSize: 'A4',
    pageMargins: [50, 70, 50, 50],

    // Header repeat ทุกหน้า ตั้งแต่หน้า 2
    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null
      return {
        text: `สัญญาเช่า ${contractNo} · หน้า ${currentPage}/${pageCount}`,
        alignment: 'right',
        fontSize: 9,
        color: '#64748b',
        margin: [50, 30, 50, 0],
      }
    },

    footer: (currentPage: number, pageCount: number) => ({
      text: `หน้า ${currentPage}/${pageCount}`,
      alignment: 'center',
      fontSize: 9,
      color: '#94a3b8',
      margin: [0, 20, 0, 0],
    }),

    content: [
      // Title block
      {
        text: 'สัญญาเช่า',
        style: 'docTitle',
        alignment: 'center',
      },
      {
        text: `เลขที่ ${contractNo}`,
        alignment: 'center',
        fontSize: 12,
        color: '#475569',
        margin: [0, 2, 0, 16] as [number, number, number, number],
      },

      // Date / Place strip
      madeDate || madeAt
        ? {
            text: [
              madeDate ? `ทำที่ ${madeAt || '....................'} ` : '',
              madeDate ? `เมื่อวันที่ ${madeDate}` : '',
            ].join(''),
            fontSize: 11,
            margin: [0, 0, 0, 12] as [number, number, number, number],
          }
        : ({ text: '', margin: [0, 0, 0, 8] } as Content),

      // Parties
      {
        text: 'คู่สัญญา',
        style: 'sectionTitle',
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: 'ผู้ให้เช่า', style: 'partyLabel' },
              { text: 'ผู้เช่า', style: 'partyLabel' },
            ],
            [
              partyBlock({
                label: 'ผู้ให้เช่า',
                name: landlordName,
                taxId: refs.landlord?.data?.taxId,
                phone: refs.landlord?.data?.phone,
                address: landlordAddress(refs.landlord, d.landlordAddr),
                signerName: refs.landlord?.data?.signerName,
                signerTitle: refs.landlord?.data?.signerTitle,
                isCompany: landlordIsCompany,
              }),
              partyBlock({
                label: 'ผู้เช่า',
                name: tenantName,
                taxId: refs.tenant?.data?.taxId ?? d.taxId,
                phone: refs.tenant?.data?.phone,
                address: tenantAddress(refs.tenant, d.tenantAddr),
                signerName: refs.tenant?.data?.signerName ?? d.tenantSignerName,
                signerTitle: refs.tenant?.data?.signerTitle ?? d.tenantSignerTitle,
                isCompany: tenantIsCompany,
              }),
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f1f5f9' : null),
          paddingTop: () => 8,
          paddingBottom: () => 8,
          paddingLeft: () => 10,
          paddingRight: () => 10,
        },
        margin: [0, 0, 0, 14] as [number, number, number, number],
      },

      // Parent contract if sublease
      d.parent_contract_id && refs.parent
        ? ({
            text: [
              { text: 'หมายเหตุการเช่าช่วง: ', italics: true, color: '#475569' },
              { text: `สัญญานี้เช่าช่วงจากสัญญาเลขที่ ${refs.parent.data?.no ?? `#${refs.parent.id}`}` },
            ],
            fontSize: 10,
            margin: [0, 0, 0, 10] as [number, number, number, number],
          } as Content)
        : ({ text: '', margin: [0, 0, 0, 0] } as Content),

      // Property
      { text: 'ทรัพย์สินที่เช่า', style: 'sectionTitle' },
      {
        table: {
          widths: [120, '*'],
          body: [
            [{ text: 'ชื่อทรัพย์สิน', style: 'key' }, { text: propName, bold: true }],
            [{ text: 'ที่อยู่', style: 'key' }, { text: propAddr }],
            ...(propTitleDeed
              ? [[{ text: 'เลขโฉนด/รายละเอียด', style: 'key' }, { text: propTitleDeed }]]
              : []),
            ...(propArea
              ? [[{ text: 'เนื้อที่', style: 'key' }, { text: propArea }]]
              : []),
          ],
        },
        layout: {
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 10,
          paddingRight: () => 10,
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
        },
        margin: [0, 0, 0, 14] as [number, number, number, number],
      },

      // Body: intro + 12 clauses (with sub-clauses) + closing — from v1 template
      ...renderClauses(c),
      { text: '', margin: [0, 8, 0, 0] as [number, number, number, number] },

      // Signature blocks · main parties
      {
        unbreakable: true,
        stack: [
          {
            columns: [
              signatureBlock('ลงชื่อ ผู้ให้เช่า', landlordName, landlordIsCompany ? refs.landlord?.data?.signerName : undefined),
              signatureBlock('ลงชื่อ ผู้เช่า', tenantName, tenantIsCompany ? (refs.tenant?.data?.signerName ?? d.tenantSignerName) : undefined),
            ],
            columnGap: 30,
          },
          { text: '', margin: [0, 16, 0, 0] as [number, number, number, number] },
          {
            columns: [
              signatureBlock('ลงชื่อ พยาน', d.wit1 || ''),
              signatureBlock('ลงชื่อ พยาน', d.wit2 || ''),
            ],
            columnGap: 30,
          },
        ],
      },
    ],

    defaultStyle: {
      font: 'Sarabun',
      fontSize: 11,
      lineHeight: 1.5,
    },
    styles: {
      docTitle: { fontSize: 20, bold: true, color: '#1e3a5f' },
      sectionTitle: {
        fontSize: 13,
        bold: true,
        color: '#1e3a5f',
        margin: [0, 10, 0, 6] as [number, number, number, number],
      },
      partyLabel: {
        fontSize: 9,
        bold: true,
        color: '#64748b',
        characterSpacing: 1,
      },
      key: { color: '#475569', fontSize: 10.5 },
      clauseList: {
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
    },
  }
}

function signatureBlock(label: string, partyName: string, signerName?: string): Content {
  return {
    stack: [
      { text: '', margin: [0, 30, 0, 0] as [number, number, number, number] },
      {
        canvas: [
          {
            type: 'line',
            x1: 20,
            y1: 0,
            x2: 200,
            y2: 0,
            lineWidth: 0.5,
            lineColor: '#1e3a5f',
          },
        ],
      },
      {
        text: `( ${signerName ?? partyName ?? '..............................'} )`,
        alignment: 'center',
        fontSize: 11,
        bold: true,
        margin: [0, 4, 0, 0] as [number, number, number, number],
      },
      {
        text: label,
        alignment: 'center',
        fontSize: 10,
        color: '#475569',
      },
      {
        text: '(......../......../........)',
        alignment: 'center',
        fontSize: 10,
        color: '#94a3b8',
        margin: [0, 2, 0, 0] as [number, number, number, number],
      },
    ],
    width: '*',
  } as Content
}

/**
 * Helper · BE string → Date · for fmtThaiLong
 * (avoiding direct parseBE dependency cycle if any)
 */
function parseBeToDate(beStr: string): Date | null {
  const m = beStr.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m?.[1] && m?.[2] && m?.[3]) {
    const dd = Number.parseInt(m[1], 10)
    const mm = Number.parseInt(m[2], 10) - 1
    const yyyy = Number.parseInt(m[3], 10) - 543
    return new Date(yyyy, mm, dd)
  }
  return null
}
