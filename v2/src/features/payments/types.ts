export type PaymentStatus = 'matched' | 'partial' | 'unallocated' | 'other'
export type PayMethod = 'transfer' | 'cash' | 'check' | 'promptpay'

export interface PaymentAllocation {
  invoice_id: string
  amount: number
  note?: string
}

export interface PaymentData {
  date: string                   // BE date string DD/MM/YYYY
  time?: string                  // HH:MM จาก statement (ช่วยทำ fingerprint กันซ้ำ)
  amount: number                 // ยอดรับจริง
  bank_account_id?: string       // FK bank_accounts
  contract_id?: string           // FK contracts (สัญญาหลัก)
  payMethod?: PayMethod
  payerName?: string             // ชื่อผู้โอน
  sourceBankCode?: string        // ธนาคารต้นทาง เช่น KBANK (จาก statement)
  sourceAcctSuffix?: string      // เลขท้ายบัญชีต้นทาง เช่น 9812 — ใช้ "จำผู้เช่า" (A)
  pickedManually?: boolean       // พนักงานเลือกผู้เช่าเอง (≠ ระบบเดา) → ใช้ถ่วงน้ำหนักตอนเรียนรู้ (A)
  fingerprint?: string           // ลายนิ้วมือของ "โอนต้นทาง" (วันที่+ยอดเต็ม+เวลา+เลขต้นทาง) — กันซ้ำแม้แบ่งจ่าย (D)
  slipRef?: string               // unique transRef จาก slip
  slipImageUrl?: string
  receiptNo?: string             // เลขใบเสร็จ
  notes?: string
  status: PaymentStatus
  allocations: PaymentAllocation[]
}

export interface Payment {
  id: string
  data: PaymentData
  created_at: string
  updated_at: string
}
