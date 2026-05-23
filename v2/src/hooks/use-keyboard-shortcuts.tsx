import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useSearch } from '@/context/search-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Routes a `Cmd/Ctrl+N` press should map to, keyed by current pathname prefix. */
const NEW_TARGETS: Record<string, string> = {
  '/contracts': '/contracts/new',
  '/invoices': '/invoices/new',
  '/tenants': '/tenants/new',
  '/landlords': '/landlords/new',
  '/properties': '/properties/new',
  '/bank-accounts': '/bank-accounts/new',
  '/meters': '/meters/new',
}

/** `g <letter>` chord → destination route. */
const GO_CHORDS: Record<string, string> = {
  d: '/dashboard',
  c: '/contracts',
  i: '/invoices',
  t: '/tenants',
  l: '/landlords',
  p: '/properties',
}

const CHORD_TIMEOUT_MS = 1000

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * Installs global keyboard shortcuts:
 *   · Cmd/Ctrl+K — open command palette (also already wired in SearchProvider)
 *   · Cmd/Ctrl+N — create-new on the current entity page
 *   · g d/c/i/t/l/p — vim-chord navigation
 *   · ? — open shortcuts cheatsheet
 *
 * Returns `{ helpOpen, setHelpOpen }` so the host can render the cheatsheet dialog.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setOpen: setSearchOpen } = useSearch()
  const [helpOpen, setHelpOpen] = useState(false)
  const lastChord = useRef<{ key: string; ts: number } | null>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey
      const editable = isEditable(e.target)

      // Cmd+K — always (works inside inputs too)
      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }

      // skip all other shortcuts while typing
      if (editable) return

      // Cmd+N — new on current entity
      if (cmd && e.key.toLowerCase() === 'n') {
        const prefix = '/' + (pathname.split('/')[1] ?? '')
        const target = NEW_TARGETS[prefix]
        if (target) {
          e.preventDefault()
          navigate({ to: target })
        }
        return
      }

      // `?` — open help (Shift+/ on US layout)
      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
        return
      }

      // chord: `g` then letter
      const now = Date.now()
      const prev = lastChord.current
      if (
        prev &&
        prev.key === 'g' &&
        now - prev.ts < CHORD_TIMEOUT_MS &&
        !cmd
      ) {
        const dest = GO_CHORDS[e.key.toLowerCase()]
        if (dest) {
          e.preventDefault()
          navigate({ to: dest })
          lastChord.current = null
          return
        }
        // any other key after `g` cancels the chord
        lastChord.current = null
      }

      if (e.key.toLowerCase() === 'g' && !cmd && !e.shiftKey) {
        lastChord.current = { key: 'g', ts: now }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, pathname, setSearchOpen])

  return { helpOpen, setHelpOpen }
}

const SHORTCUT_GROUPS: { title: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    title: 'ทั่วไป',
    rows: [
      { keys: ['⌘', 'K'], label: 'เปิดช่องค้นหา' },
      { keys: ['⌘', 'N'], label: 'สร้างรายการใหม่ (ตามหน้าที่อยู่)' },
      { keys: ['?'], label: 'เปิดหน้านี้' },
      { keys: ['Esc'], label: 'ปิด dialog/modal' },
    ],
  },
  {
    title: 'นำทาง (กด g แล้วตามด้วย)',
    rows: [
      { keys: ['g', 'd'], label: 'แดชบอร์ด' },
      { keys: ['g', 'c'], label: 'สัญญา' },
      { keys: ['g', 'i'], label: 'ใบแจ้งหนี้' },
      { keys: ['g', 't'], label: 'ผู้เช่า' },
      { keys: ['g', 'l'], label: 'ผู้ให้เช่า' },
      { keys: ['g', 'p'], label: 'ทรัพย์สิน' },
    ],
  },
]

export function ShortcutsHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>คีย์ลัด</DialogTitle>
          <DialogDescription>
            ใช้ทำงานเร็วขึ้น — กด <kbd className='rounded border bg-muted px-1 text-xs'>?</kbd>{' '}
            เมื่อไหร่ก็ได้
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.title}>
              <p className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
                {g.title}
              </p>
              <ul className='space-y-1.5 text-sm'>
                {g.rows.map((r) => (
                  <li
                    key={r.label}
                    className='flex items-center justify-between gap-3'
                  >
                    <span>{r.label}</span>
                    <span className='flex gap-1'>
                      {r.keys.map((k) => (
                        <kbd
                          key={k}
                          className='inline-flex min-w-[1.6em] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums'
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
