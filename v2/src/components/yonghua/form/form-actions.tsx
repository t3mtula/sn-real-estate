import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FormActionsProps {
  /** Save handler · async OK */
  onSave?: () => void | Promise<void>
  /** Cancel handler · เช่น nav back */
  onCancel?: () => void
  /** Delete handler · เช่น delete record · render เฉพาะถ้ามี */
  onDelete?: () => void | Promise<void>
  saveLabel?: string
  cancelLabel?: string
  deleteLabel?: string
  /** กำลัง save · disable ทุก action */
  saving?: boolean
  /** มี unsaved changes · เปลี่ยน label/badge */
  dirty?: boolean
  /** disable save (เช่น form invalid) */
  disabled?: boolean
  /** "sticky" = ติด bottom (default) · "static" = ปกติ */
  variant?: "sticky" | "static"
  /** additional ทาง left (เช่น helper text · "ปรับล่าสุด: 2 นาทีที่แล้ว") */
  leftSlot?: ReactNode
  className?: string
}

/**
 * FormActions · Save / Cancel / Delete button bar ที่ติด bottom
 *
 * ลูกน้องไม่ต้อง scroll หา Save · กดได้ตลอด
 * Show "บันทึก *" (มี asterisk) ตอน dirty · "กำลังบันทึก..." ตอน saving
 */
export function FormActions({
  onSave,
  onCancel,
  onDelete,
  saveLabel = "บันทึก",
  cancelLabel = "ยกเลิก",
  deleteLabel = "ลบ",
  saving,
  dirty,
  disabled,
  variant = "sticky",
  leftSlot,
  className,
}: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t bg-background px-6 py-3",
        variant === "sticky" && "sticky bottom-0 z-10 -mx-8 -mb-8 mt-6 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="text-sm text-muted-foreground">
        {leftSlot ??
          (dirty ? (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              ยังไม่บันทึก
            </span>
          ) : null)}
      </div>
      <div className="flex items-center gap-2">
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={saving}
            className="text-destructive hover:text-destructive"
          >
            {deleteLabel}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {cancelLabel}
          </Button>
        )}
        {onSave && (
          <Button type="button" onClick={onSave} disabled={saving || disabled}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            <span className={cn(saving && "ml-2")}>
              {saving ? "กำลังบันทึก..." : `${saveLabel}${dirty ? " *" : ""}`}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
