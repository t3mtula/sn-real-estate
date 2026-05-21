import { Home } from "lucide-react"
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Command palette (⌘K / Ctrl+K) · global search · navigation · actions
 * แต่ละ app เพิ่ม items ของตัวเอง
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  function go(to: string) {
    onOpenChange(false)
    navigate(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="พิมพ์ค้นหา หรือเลือกคำสั่ง..." />
      <CommandList>
        <CommandEmpty>ไม่พบ</CommandEmpty>
        <CommandGroup heading="ไปที่">
          <CommandItem onSelect={() => go("/")}>
            <Home className="mr-2 size-4" />
            หน้าหลัก
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
