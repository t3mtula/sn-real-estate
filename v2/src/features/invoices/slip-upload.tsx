import { useRef, useState } from 'react'
import { Image, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Invoice } from './types'

// Store slip in data.slipImage as base64 (same as v1)
function useSetSlipImage(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (slipImage: string | null) => {
      const { data: existing, error: readError } = await supabase
        .from('invoices')
        .select('data')
        .eq('id', id)
        .single()
      if (readError) throw readError
      const merged = { ...(existing?.data ?? {}), slipImage: slipImage ?? undefined }
      if (!slipImage) delete (merged as Record<string, unknown>).slipImage
      const { error } = await supabase
        .from('invoices')
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

interface Props {
  invoice: Invoice
}

export function SlipUpload({ invoice }: Props) {
  const slipImage = invoice.data?.slipImage as string | undefined
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const setSlip = useSetSlipImage(invoice.id)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2_000_000) { toast.error('ไฟล์ใหญ่เกิน 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      setSlip.mutate(dataUrl, {
        onSuccess: () => toast.success('อัปโหลด slip แล้ว'),
        onError: (e) => toast.error('อัปโหลดไม่สำเร็จ', { description: String(e) }),
      })
    }
    reader.readAsDataURL(file)
  }

  function handleRemove() {
    setPreview(null)
    setSlip.mutate(null, {
      onSuccess: () => toast.success('ลบ slip แล้ว'),
      onError: (e) => toast.error('ลบไม่สำเร็จ', { description: String(e) }),
    })
  }

  const src = preview ?? slipImage

  return (
    <div className='rounded-md border bg-card p-4 space-y-2'>
      <div className='flex items-center gap-2'>
        <Image className='size-4 text-blue-500' />
        <span className='text-sm font-medium'>Slip การโอนเงิน</span>
        {!src && (
          <Button size='sm' variant='outline' className='ml-auto h-7 text-xs gap-1' onClick={() => fileRef.current?.click()} disabled={setSlip.isPending}>
            <Image className='size-3' />
            อัปโหลด
          </Button>
        )}
        {src && (
          <Button size='sm' variant='ghost' className='ml-auto h-7 text-xs text-destructive' onClick={handleRemove} disabled={setSlip.isPending}>
            <X className='size-3' />ลบ
          </Button>
        )}
        <input ref={fileRef} type='file' accept='image/*' className='hidden' onChange={handleFile} />
      </div>
      {src ? (
        <img
          src={src}
          alt='slip'
          className='max-h-[300px] w-full cursor-pointer rounded-md border object-contain'
          onClick={() => window.open(src, '_blank')}
        />
      ) : (
        <p className='text-xs text-muted-foreground'>ยังไม่มี slip · กด "อัปโหลด" เพื่อแนบรูป</p>
      )}
    </div>
  )
}
