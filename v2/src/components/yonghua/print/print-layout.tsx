import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PrintLayoutProps {
  children: ReactNode
  /** A4 portrait (default) หรือ landscape */
  orientation?: "portrait" | "landscape"
  /** wrap in a preview shell ตอน screen (สีเทาด้านนอก · เห็นกระดาษชัด) */
  preview?: boolean
  className?: string
}

/**
 * PrintLayout · A4 paper wrapper
 * - Screen: show as A4 sheet with shadow (preview)
 * - Print: fill the page, no shadow
 *
 * ใช้ครอบทั้งเอกสาร · ภายในใช้ PrintHeader, PrintSection, PrintTable, PrintFooter
 *
 * Multi-page: ใส่ <PrintLayout> หลายตัวต่อกัน · แต่ละตัว = 1 หน้า · หรือใช้
 * <PrintPageBreak /> เพื่อ force break ภายใน PrintLayout เดียว
 */
export function PrintLayout({
  children,
  orientation = "portrait",
  preview = false,
  className,
}: PrintLayoutProps) {
  const inner = (
    <div
      className={cn(
        "print-page font-sans text-[12pt] leading-relaxed text-black",
        orientation === "landscape" && "print-page-landscape",
        className,
      )}
    >
      {children}
    </div>
  )

  if (preview) {
    return <div className="print-preview-wrap">{inner}</div>
  }
  return inner
}

/**
 * Force page break · ใส่ระหว่างเนื้อหา
 */
export function PrintPageBreak() {
  return <div className="page-break-after" />
}
