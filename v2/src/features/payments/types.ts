export type PaymentStatus = 'matched' | 'partial' | 'unallocated'
export type PayMethod = 'transfer' | 'cash' | 'check' | 'promptpay'

export interface PaymentAllocation {
  invoice_id: string
  amount: number
  note?: string
}

export interface PaymentData {
  date: string                   // BE date string DD/MM/YYYY
  amount: number                 // ยอดรับจริง
  bank_account_id?: string       // FK bank_accounts
  contract_id?: string           // FK contracts (สัญญาหลัก)
  payMethod?: PayMethod
  payerName?: string             // ชื่อผู้โอน
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
