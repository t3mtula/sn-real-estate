import { useEffect } from "react"

interface UnsavedChangesWarningProps {
  /** มีการเปลี่ยนแปลงที่ยังไม่ save */
  dirty: boolean
  /** ข้อความตอน beforeunload (browser อาจไม่แสดง message custom · แต่ block ได้) */
  message?: string
}

/**
 * UnsavedChangesWarning · เตือน user ตอนปิด tab / refresh ขณะมี dirty form
 *
 * <UnsavedChangesWarning dirty={form.formState.isDirty} />
 *
 * Note: react-router native blocker (useBlocker) ใช้ใน route component แยก
 * นี่จัดการแค่ beforeunload (browser-level)
 */
export function UnsavedChangesWarning({
  dirty,
  message = "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก · ยืนยันการออกหรือไม่?",
}: UnsavedChangesWarningProps) {
  useEffect(() => {
    if (!dirty) return

    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      // legacy browsers
      e.returnValue = message
      return message
    }

    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty, message])

  return null
}
