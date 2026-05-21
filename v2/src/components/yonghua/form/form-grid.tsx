import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FormGridProps {
  /** column count · default 2 · desktop-first */
  cols?: 1 | 2 | 3 | 4
  children: ReactNode
  className?: string
}

/**
 * FormGrid · 1-4 column layout · gap consistent
 *
 * ใช้ Tailwind grid · field กว้าง fixed · ไม่ stretch หน้า
 * ใช้ <FormGrid.Item span={2}> ทำ field ที่ต้องการกินหลาย column
 */
export function FormGrid({ cols = 2, children, className }: FormGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 md:grid-cols-2",
        cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface FormGridItemProps {
  /** column span · default 1 · เช่น 2 = กิน 2 columns */
  span?: 1 | 2 | 3 | 4
  /** ดันลงบรรทัดใหม่ */
  startRow?: boolean
  children: ReactNode
  className?: string
}

FormGrid.Item = function FormGridItem({
  span = 1,
  startRow = false,
  children,
  className,
}: FormGridItemProps) {
  return (
    <div
      className={cn(
        span === 2 && "md:col-span-2",
        span === 3 && "md:col-span-2 lg:col-span-3",
        span === 4 && "md:col-span-2 lg:col-span-4",
        startRow && "md:col-start-1",
        className,
      )}
    >
      {children}
    </div>
  )
}
