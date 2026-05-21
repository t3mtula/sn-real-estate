import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PrintSectionProps {
  title?: string
  children: ReactNode
  /** กัน section ตัดหน้ากลาง (เนื้อหาน้อย) */
  avoidBreak?: boolean
  className?: string
}

/**
 * PrintSection · group เนื้อหาภายในเอกสาร · มี title + เส้นแบ่ง
 */
export function PrintSection({ title, children, avoidBreak, className }: PrintSectionProps) {
  return (
    <section className={cn("mb-5", avoidBreak && "page-break-avoid", className)}>
      {title && (
        <h2 className="mb-2 border-b border-gray-400 pb-1 text-[13pt] font-semibold">{title}</h2>
      )}
      <div className="text-[11pt] leading-relaxed">{children}</div>
    </section>
  )
}

interface PrintFieldProps {
  label: string
  value?: ReactNode
  /** label width · default "8rem" */
  labelWidth?: string
  inline?: boolean
}

/**
 * PrintField · label : value (เหมือนฟอร์ม readonly สำหรับ print)
 */
export function PrintField({ label, value, labelWidth = "8rem", inline = false }: PrintFieldProps) {
  if (inline) {
    return (
      <span className="text-[11pt]">
        <span className="text-gray-700">{label}:</span> <strong>{value ?? "—"}</strong>
      </span>
    )
  }
  return (
    <div className="mb-1 flex gap-3 text-[11pt]">
      <span className="shrink-0 text-gray-700" style={{ width: labelWidth }}>
        {label}:
      </span>
      <span className="flex-1 font-medium">{value ?? "—"}</span>
    </div>
  )
}
