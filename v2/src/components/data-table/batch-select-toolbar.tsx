/**
 * BatchSelectToolbar — แถบลอย "เลือกหลายรายการ" กลาง (ของกลางทั้งแอป)
 *
 * หน้าตา = pill ลอยล่างจอ (rounded-full + backdrop-blur) แบบที่หน้าสัญญา/ใบแจ้งหนี้ใช้จริง
 * a11y = role=toolbar + ประกาศ screen reader + ปุ่มลูกศรเลื่อน focus + Esc ล้างการเลือก
 *        (ยกมาจาก data-table/bulk-actions.tsx เดิมที่ไม่ถูกใช้ แล้วเลิกใช้ไฟล์นั้น)
 *
 * ไม่ผูกกับ table → ใช้กับการ์ด (landlords) ได้ · ปุ่ม action ของแต่ละหน้าใส่ผ่าน children
 */
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type BatchSelectToolbarProps = {
  selectedCount: number
  /** ชื่อสิ่งที่เลือก เช่น "สัญญา" "ใบแจ้งหนี้" — โชว์ "เลือก N <entityName>" */
  entityName: string
  onClear: () => void
  /** สรุปเสริม (เช่น ยอดรวมที่เลือก) วางถัดจากตัวนับ ก่อนปุ่ม action */
  summary?: React.ReactNode
  /** ปุ่ม action ของหน้านั้น */
  children: React.ReactNode
}

/** focus อยู่ใน portal ของ popover/dropdown/select (Radix popper) ไหม — ถ้าใช่ Esc ไม่ล้างการเลือก */
function isInPopper(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  return !!node?.closest?.('[data-radix-popper-content-wrapper]')
}

export function BatchSelectToolbar({
  selectedCount,
  entityName,
  onClear,
  summary,
  children,
}: BatchSelectToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')

  // ประกาศจำนวนที่เลือกให้ screen reader
  useEffect(() => {
    if (selectedCount > 0) {
      queueMicrotask(() =>
        setAnnouncement(`เลือก ${selectedCount} ${entityName} · มีแถบเครื่องมือให้ใช้`),
      )
      const timer = setTimeout(() => setAnnouncement(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [selectedCount, entityName])

  function handleKeyDown(event: React.KeyboardEvent) {
    const buttons = toolbarRef.current?.querySelectorAll('button')
    if (!buttons || buttons.length === 0) return
    const current = Array.from(buttons).findIndex((b) => b === document.activeElement)

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault()
        buttons[(current + 1) % buttons.length]?.focus()
        break
      }
      case 'ArrowLeft': {
        event.preventDefault()
        buttons[current <= 0 ? buttons.length - 1 : current - 1]?.focus()
        break
      }
      case 'Home':
        event.preventDefault()
        buttons[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        buttons[buttons.length - 1]?.focus()
        break
      case 'Escape': {
        // ถ้า Esc มาจาก popover/dropdown ที่เปิดอยู่ → ปล่อยให้มันปิด ไม่ล้างการเลือก
        if (isInPopper(event.target) || isInPopper(document.activeElement)) return
        event.preventDefault()
        onClear()
        break
      }
    }
  }

  if (selectedCount === 0) return null

  return (
    <>
      {/* live region สำหรับ screen reader */}
      <div aria-live='polite' aria-atomic='true' role='status' className='sr-only'>
        {announcement}
      </div>

      <div className='pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4'>
        <div
          ref={toolbarRef}
          role='toolbar'
          aria-label={`การจัดการ ${selectedCount} ${entityName} ที่เลือก`}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className={cn(
            'pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border px-4 py-2 shadow-lg',
            'bg-card/95 backdrop-blur',
            'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
          )}
        >
          <span className='text-sm font-semibold'>
            เลือก {selectedCount.toLocaleString('th-TH')} {entityName}
          </span>

          {summary != null && (
            <>
              <span className='h-4 w-px bg-border' />
              {summary}
            </>
          )}

          <span className='h-4 w-px bg-border' />
          {children}

          <span className='h-4 w-px bg-border' />
          <Button
            size='sm'
            variant='ghost'
            onClick={onClear}
            aria-label='ล้างการเลือก'
            title='ล้างการเลือก (Esc)'
          >
            <X className='size-4' />
          </Button>
        </div>
      </div>
    </>
  )
}
