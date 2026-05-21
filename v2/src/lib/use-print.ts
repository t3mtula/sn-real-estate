import { useCallback, useState } from "react"

/**
 * usePrint hook · trigger window.print() ที่จัด state + title ให้
 *
 * Usage:
 *   const { print, isPrinting } = usePrint()
 *   <Button onClick={() => print({ title: "สัญญา-001-2569" })}>พิมพ์</Button>
 *
 * Note: title ใช้เป็นชื่อไฟล์ default ตอน Save as PDF
 */
export function usePrint() {
  const [isPrinting, setIsPrinting] = useState(false)

  const print = useCallback((opts?: { title?: string }) => {
    const prevTitle = document.title
    if (opts?.title) document.title = opts.title
    setIsPrinting(true)
    // Defer to let any UI update (เช่น hide buttons) ก่อน trigger print
    setTimeout(() => {
      window.print()
      setTimeout(() => {
        setIsPrinting(false)
        if (opts?.title) document.title = prevTitle
      }, 500)
    }, 50)
  }, [])

  return { print, isPrinting }
}
