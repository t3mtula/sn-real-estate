/**
 * Thai bank logo lookup
 *
 * Source: thai-banks-logo npm package (21 banks · PNG icons)
 * Icons mirrored to /public/bank-logos/{SYMBOL}.png — self-host, no CDN dep.
 *
 * Match strategy (in priority order):
 *   1. exact nameLong  (e.g. "ธนาคารกรุงเทพ")
 *   2. exact name      (e.g. "กรุงเทพ")
 *   3. strip "ธนาคาร" prefix from input → match name
 *   4. strip "ธ."     prefix from input → match name
 *   5. partial includes (input contains name or vice versa)
 *   6. symbol case-insensitive (e.g. "KBANK" / "kbank")
 */

type BankEntry = {
  symbol: string
  name: string
  nameLong: string
  nameEN: string
  /** path under /public — `/bank-logos/${symbol}.png` */
  logoUrl: string
}

const BANKS: readonly BankEntry[] = [
  { symbol: 'BAAC', name: 'ธ.ก.ส.', nameLong: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', nameEN: 'BAAC', logoUrl: '/bank-logos/BAAC.png' },
  { symbol: 'BAY', name: 'กรุงศรีอยุธยา', nameLong: 'ธนาคารกรุงศรีอยุธยา', nameEN: 'Krungsri', logoUrl: '/bank-logos/BAY.png' },
  { symbol: 'BBL', name: 'กรุงเทพ', nameLong: 'ธนาคารกรุงเทพ', nameEN: 'Bangkok Bank', logoUrl: '/bank-logos/BBL.png' },
  { symbol: 'CIMB', name: 'ซีไอเอ็มบี', nameLong: 'ธนาคารซีไอเอ็มบี', nameEN: 'CIMB Thai', logoUrl: '/bank-logos/CIMB.png' },
  { symbol: 'CITI', name: 'ซิตี้แบงก์', nameLong: 'ธนาคารซิตี้แบงก์', nameEN: 'Citibank', logoUrl: '/bank-logos/CITI.png' },
  { symbol: 'GHB', name: 'ธ.อ.ส.', nameLong: 'ธนาคารอาคารสงเคราะห์', nameEN: 'GH Bank', logoUrl: '/bank-logos/GHB.png' },
  { symbol: 'GSB', name: 'ออมสิน', nameLong: 'ธนาคารออมสิน', nameEN: 'GSB', logoUrl: '/bank-logos/GSB.png' },
  { symbol: 'HSBC', name: 'เอชเอสบีซี', nameLong: 'ธนาคารเอชเอสบีซี', nameEN: 'HSBC', logoUrl: '/bank-logos/HSBC.png' },
  { symbol: 'IBANK', name: 'อิสลามแห่งประเทศไทย', nameLong: 'ธนาคารอิสลามแห่งประเทศไทย', nameEN: 'Islamic Bank', logoUrl: '/bank-logos/IBANK.png' },
  { symbol: 'ICBC', name: 'ไอซีบีซี', nameLong: 'ธนาคารไอซีบีซี', nameEN: 'ICBC', logoUrl: '/bank-logos/ICBC.png' },
  { symbol: 'KBANK', name: 'กสิกรไทย', nameLong: 'ธนาคารกสิกรไทย', nameEN: 'Kasikorn', logoUrl: '/bank-logos/KBANK.png' },
  { symbol: 'KKP', name: 'เกียรตินาคิน', nameLong: 'ธนาคารเกียรตินาคินภัทร', nameEN: 'Kiatnakin', logoUrl: '/bank-logos/KKP.png' },
  { symbol: 'KTB', name: 'กรุงไทย', nameLong: 'ธนาคารกรุงไทย', nameEN: 'Krungthai', logoUrl: '/bank-logos/KTB.png' },
  { symbol: 'LHB', name: 'แลนด์ แอนด์ เฮ้าส์', nameLong: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', nameEN: 'LH Bank', logoUrl: '/bank-logos/LHB.png' },
  { symbol: 'PromptPay', name: 'พร้อมเพย์', nameLong: 'พร้อมเพย์', nameEN: 'PromptPay', logoUrl: '/bank-logos/PromptPay.png' },
  { symbol: 'SCB', name: 'ไทยพาณิชย์', nameLong: 'ธนาคารไทยพาณิชย์', nameEN: 'SCB', logoUrl: '/bank-logos/SCB.png' },
  { symbol: 'TCRB', name: 'ไทยเครดิต', nameLong: 'ธนาคารไทยเครดิต', nameEN: 'Thai Credit', logoUrl: '/bank-logos/TCRB.png' },
  { symbol: 'TISCO', name: 'ทิสโก้', nameLong: 'ธนาคารทิสโก้', nameEN: 'Tisco', logoUrl: '/bank-logos/TISCO.png' },
  { symbol: 'TrueMoney', name: 'ทรูมันนี่', nameLong: 'ทรูมันนี่', nameEN: 'TrueMoney', logoUrl: '/bank-logos/TrueMoney.png' },
  { symbol: 'TTB', name: 'ทีเอ็มบีธนชาต', nameLong: 'ธนาคารทีเอ็มบีธนชาต', nameEN: 'TTB', logoUrl: '/bank-logos/TTB.png' },
  { symbol: 'UOB', name: 'ยูโอบี', nameLong: 'ธนาคารยูโอบี', nameEN: 'UOB', logoUrl: '/bank-logos/UOB.png' },
]

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Look up a bank by user-typed name (Thai or English).
 * Returns the matched entry, or null if no match.
 */
export function findBank(input: string | null | undefined): BankEntry | null {
  if (!input) return null
  const raw = input.trim()
  if (!raw) return null

  // 1. exact nameLong / name / nameEN / symbol
  for (const b of BANKS) {
    if (raw === b.nameLong || raw === b.name || raw === b.nameEN || raw === b.symbol) {
      return b
    }
  }

  // 2. strip "ธนาคาร" / "ธ." prefix
  const stripped = raw.replace(/^(ธนาคาร|ธ\.)\s*/, '').trim()
  if (stripped && stripped !== raw) {
    for (const b of BANKS) {
      if (stripped === b.name || stripped === b.nameLong) return b
    }
  }

  // 3. normalized loose match (ignore case + spaces)
  const norm = normalize(raw)
  for (const b of BANKS) {
    if (
      normalize(b.name) === norm ||
      normalize(b.nameLong) === norm ||
      normalize(b.nameEN) === norm ||
      normalize(b.symbol) === norm
    ) {
      return b
    }
  }

  // 4. partial includes (input contains name, or name contains input)
  for (const b of BANKS) {
    if (raw.includes(b.name) || b.name.includes(raw) || b.nameLong.includes(raw)) {
      return b
    }
  }

  return null
}

/**
 * Short fallback label when no logo matches — derive a 3-4 char abbreviation
 * from input (strip "ธ./ธนาคาร" prefix, take first chars).
 */
export function fallbackAbbr(input: string | null | undefined): string {
  if (!input) return '?'
  const stripped = input.trim().replace(/^(ธนาคาร|ธ\.)\s*/, '').trim()
  return stripped.slice(0, 4) || '?'
}
