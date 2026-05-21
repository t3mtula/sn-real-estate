import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface PrintTableColumn<T> {
  key: string
  label: string
  align?: "left" | "right" | "center"
  /** column width · CSS value (e.g., "3rem" หรือ "20%") */
  width?: string
  render?: (row: T, index: number) => ReactNode
}

interface PrintTableProps<T> {
  columns: PrintTableColumn<T>[]
  rows: T[]
  /** footer row (e.g., รวม VAT) · render ใต้ตาราง · repeat ทุกหน้า */
  footer?: ReactNode
  /** "compact" = padding น้อย · default "normal" */
  density?: "compact" | "normal"
  className?: string
}

/**
 * PrintTable · table ที่ optimize สำหรับ print
 * - thead repeat ทุกหน้า
 * - tfoot repeat ทุกหน้า
 * - row ห้ามตัดหน้ากลาง (break-inside: avoid)
 * - word-break ที่ทุก cell กัน overflow
 */
export function PrintTable<T>({
  columns,
  rows,
  footer,
  density = "normal",
  className,
}: PrintTableProps<T>) {
  const padding = density === "compact" ? "px-2 py-1" : "px-3 py-2"

  return (
    <table className={cn("w-full border-collapse text-[11pt]", className)}>
      <thead>
        <tr className="border-b-2 border-black">
          {columns.map((col) => (
            <th
              key={col.key}
              className={cn(
                padding,
                "font-semibold",
                col.align === "right" && "text-right",
                col.align === "center" && "text-center",
                col.align === "left" && "text-left",
                !col.align && "text-left",
              )}
              style={col.width ? { width: col.width } : undefined}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            // biome-ignore lint/suspicious/noArrayIndexKey: caller controls row identity via render
            key={i}
            className="border-b border-gray-300"
          >
            {columns.map((col) => {
              const value = col.render
                ? col.render(row, i)
                : (row as unknown as Record<string, ReactNode>)[col.key]
              return (
                <td
                  key={col.key}
                  className={cn(
                    padding,
                    "break-words",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                  )}
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  {value as ReactNode}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="border-t-2 border-black font-semibold">
            <td colSpan={columns.length} className={padding}>
              {footer}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}
