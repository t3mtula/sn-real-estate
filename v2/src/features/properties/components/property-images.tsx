import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PropertyImagesProps = {
  images: string[]
  alt: string
}

/**
 * Image gallery — thumbnail grid + lightbox · navigation arrows + keyboard (←/→/Esc)
 *
 * v1 stored images as base64 dataURLs in JSONB.
 * v2 will store URLs from Supabase Storage going forward (decisions.md).
 * This component handles BOTH: data URL strings + public URLs (transparent to user).
 */
export function PropertyImages({ images, alt }: PropertyImagesProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
      else if (e.key === "ArrowRight") setActive((i) => Math.min(i + 1, images.length - 1))
      else if (e.key === "ArrowLeft") setActive((i) => Math.max(i - 1, 0))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, images.length])

  if (!images.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        <ImageOff className="mr-2 size-4" />
        ยังไม่มีรูปภาพ
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((src, i) => (
          <button
            key={`thumb-${i}-${src.slice(-12)}`}
            type="button"
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            onClick={() => {
              setActive(i)
              setOpen(true)
            }}
          >
            <img
              src={src}
              alt={`${alt} ${i + 1}`}
              loading="lazy"
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {open && images[active] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
            aria-label="ปิด"
          >
            <X className="size-5" />
          </button>

          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20",
                  active === 0 && "pointer-events-none opacity-40",
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  setActive((i) => Math.max(i - 1, 0))
                }}
                aria-label="ก่อนหน้า"
              >
                <ChevronLeft className="size-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20",
                  active >= images.length - 1 && "pointer-events-none opacity-40",
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  setActive((i) => Math.min(i + 1, images.length - 1))
                }}
                aria-label="ถัดไป"
              >
                <ChevronRight className="size-6" />
              </Button>
            </>
          )}

          <img
            src={images[active]}
            alt={`${alt} ${active + 1}`}
            className="max-h-[88vh] max-w-[88vw] rounded-md object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {active + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}
