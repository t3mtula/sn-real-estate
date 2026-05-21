import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePrint } from "@/lib/use-print"
import { cn } from "@/lib/utils"

interface PrintButtonProps {
  /** title สำหรับ Save-as-PDF filename · เช่น "สัญญาเช่า-RE-2569-001" */
  title?: string
  label?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  className?: string
}

/**
 * PrintButton · ปุ่มพิมพ์ standard
 * - มี class `no-print` · ไม่โผล่ใน print เอง
 * - กด → trigger window.print()
 */
export function PrintButton({
  title,
  label = "พิมพ์ / Save PDF",
  variant = "default",
  className,
}: PrintButtonProps) {
  const { print, isPrinting } = usePrint()
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => print({ title })}
      disabled={isPrinting}
      className={cn("no-print", className)}
    >
      <Printer className="size-4" />
      <span className="ml-2">{label}</span>
    </Button>
  )
}
