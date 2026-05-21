import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FormSectionProps {
  title?: string
  description?: string
  /** action element (right of title · เช่น "เพิ่มแถว" button) */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * FormSection · group fields ใน Card
 *
 * ใช้แบ่งฟอร์มยาวเป็นกลุ่ม (ข้อมูลผู้เช่า / ที่อยู่ / สัญญา / ฯลฯ)
 * ลูกน้องเห็นชัดว่ากำลังกรอกกลุ่มไหน
 */
export function FormSection({ title, description, action, children, className }: FormSectionProps) {
  return (
    <Card className={className}>
      {(title || description || action) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(!title && !description && "pt-6")}>{children}</CardContent>
    </Card>
  )
}
