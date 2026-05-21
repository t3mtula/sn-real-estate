import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

/**
 * confirm() helper · promise-based confirmation dialog
 *
 * Usage:
 *   const confirm = useConfirm()
 *
 *   async function handleDelete(id) {
 *     const ok = await confirm({
 *       title: "ลบลูกค้ารายนี้?",
 *       description: "ลบแล้วเรียกคืนไม่ได้",
 *       confirmLabel: "ลบ",
 *       destructive: true,
 *     })
 *     if (!ok) return
 *     remove.mutate(id)
 *   }
 *
 * Setup:
 *   <ConfirmProvider>...</ConfirmProvider> ครอบ App root (ทำให้ใน main.tsx แล้ว)
 */

interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** styles confirm button as destructive (red) · default false */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  function handleResult(value: boolean) {
    setOpen(false)
    resolverRef.current?.(value)
    resolverRef.current = null
    // delay clear options เพื่อให้ exit animation ไม่กระตุก
    setTimeout(() => setOptions(null), 200)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => !o && handleResult(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && (
              <AlertDialogDescription>{options.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleResult(false)}>
              {options?.cancelLabel ?? 'ยกเลิก'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleResult(true)}
              className={cn(
                options?.destructive &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {options?.confirmLabel ?? 'ยืนยัน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext)
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return fn
}
