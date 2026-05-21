import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PrintHeaderProps {
  title: string
  subtitle?: string
  /** เลขที่เอกสาร · เช่น "RE-2569-001" */
  documentNo?: string
  /** วันที่ พ.ศ. (format มาแล้ว) · เช่น "21 พฤษภาคม 2569" */
  date?: string
  /** Logo · brand name · ฯลฯ · มุมขวาบน */
  brand?: ReactNode
  className?: string
}

/**
 * PrintHeader · brand/title/doc-no/date · top of document
 *
 * Note: นี่ render ครั้งเดียวที่ top ของ PrintLayout · ไม่ repeat ทุกหน้า
 * ถ้าต้องการ header ที่ repeat ทุกหน้าของ table → ใช้ <thead> ของ PrintTable
 */
export function PrintHeader({
  title,
  subtitle,
  documentNo,
  date,
  brand,
  className,
}: PrintHeaderProps) {
  return (
    <header
      className={cn(
        "page-break-avoid mb-6 flex items-start justify-between gap-4 border-b-2 border-black pb-4",
        className,
      )}
    >
      <div className="flex-1">
        <h1 className="text-[18pt] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[11pt] text-gray-700">{subtitle}</p>}
      </div>
      <div className="text-right text-[10pt]">
        {brand && <div className="mb-2 font-semibold">{brand}</div>}
        {documentNo && (
          <div>
            <span className="text-gray-600">เลขที่:</span> <strong>{documentNo}</strong>
          </div>
        )}
        {date && (
          <div>
            <span className="text-gray-600">วันที่:</span> {date}
          </div>
        )}
      </div>
    </header>
  )
}
