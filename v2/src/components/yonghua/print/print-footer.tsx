import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PrintFooterProps {
  /** ลายเซ็น 2 ฝ่าย · left = ผู้ให้เช่า · right = ผู้เช่า · ฯลฯ */
  signatures?: Array<{
    label: string
    name?: string
    note?: string
  }>
  /** หมายเหตุท้ายเอกสาร */
  note?: ReactNode
  className?: string
}

/**
 * PrintFooter · ลายเซ็น + หมายเหตุ · bottom of document
 */
export function PrintFooter({ signatures, note, className }: PrintFooterProps) {
  return (
    <footer className={cn("page-break-avoid mt-8 space-y-6", className)}>
      {note && <div className="text-[10pt] text-gray-700">{note}</div>}
      {signatures && signatures.length > 0 && (
        <div
          className="grid gap-8"
          style={{
            gridTemplateColumns: `repeat(${signatures.length}, minmax(0, 1fr))`,
          }}
        >
          {signatures.map((sig, i) => (
            <div key={`${sig.label}-${i}`} className="text-center text-[11pt]">
              <div className="mb-12">ลงชื่อ</div>
              <div className="border-t border-black pt-1">
                ({sig.name ?? "................................"})
              </div>
              <div className="mt-1 text-gray-700">{sig.label}</div>
              {sig.note && <div className="mt-0.5 text-[9pt] text-gray-600">{sig.note}</div>}
            </div>
          ))}
        </div>
      )}
    </footer>
  )
}
