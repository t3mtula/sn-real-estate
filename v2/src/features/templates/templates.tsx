import { Link, useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useContractTemplates } from './queries'
import {
  useActivateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  useSeedDefaultTemplate,
} from './mutations'

export function ContractTemplates() {
  const navigate = useNavigate()
  const { data: templates, isLoading } = useContractTemplates()
  const seed = useSeedDefaultTemplate()
  const activate = useActivateTemplate()
  const duplicate = useDuplicateTemplate()
  const del = useDeleteTemplate()

  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Seed v1 default on first visit if empty
  useEffect(() => {
    if (!templates) return
    if (templates.length === 0 && !seed.isPending && !seed.isError) {
      seed.mutate(undefined, {
        onSuccess: (created) => {
          if (created) {
            toast.success('สร้างฟอร์มสัญญาเริ่มต้น (แบบมาตรฐาน) แล้ว')
          }
        },
        onError: (err) => {
          toast.error('สร้างฟอร์มเริ่มต้นไม่สำเร็จ', {
            description: err instanceof Error ? err.message : String(err),
          })
        },
      })
    }
    // intentionally only react to count change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates?.length])

  async function handleActivate(id: string) {
    try {
      await activate.mutateAsync(id)
      toast.success('ตั้งเป็นแบบใช้งานแล้ว')
    } catch (err) {
      toast.error('เปลี่ยนสถานะไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const r = await duplicate.mutateAsync(id)
      toast.success('คัดลอกฟอร์มแล้ว')
      navigate({
        to: '/templates/$id',
        params: { id: r.id },
      })
    } catch (err) {
      toast.error('คัดลอกไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await del.mutateAsync(deleteId)
      toast.success('ลบฟอร์มแล้ว')
      setDeleteId(null)
    } catch (err) {
      toast.error('ลบไม่สำเร็จ', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-5'>
        <header className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>ฟอร์มสัญญา</h1>
            <p className='text-sm text-muted-foreground'>
              จัดการข้อสัญญาที่ใช้ปริ้น · เลือกแบบที่ใช้งาน · สร้างเวอร์ชั่นใหม่
              · คัดลอกแบบเดิมแล้วแก้
            </p>
          </div>
          <Button asChild>
            <Link to='/templates/new'>
              <Plus className='size-4' />
              สร้างแบบใหม่
            </Link>
          </Button>
        </header>

        {isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={`s-${i}`} className='h-16 w-full' />
            ))}
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className='rounded-md border bg-card p-10 text-center'>
            <FileText className='mx-auto size-10 text-muted-foreground' />
            {seed.isPending ? (
              <p className='mt-3 text-sm text-muted-foreground'>
                <Loader2 className='mr-2 inline size-4 animate-spin' />
                กำลังสร้างฟอร์มเริ่มต้น...
              </p>
            ) : (
              <>
                <p className='mt-3 text-base font-medium'>ยังไม่มีฟอร์มสัญญา</p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  ระบบจะสร้าง "แบบมาตรฐาน" (12 ข้อ จาก v1) ให้อัตโนมัติ
                </p>
              </>
            )}
          </div>
        ) : (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {templates.map((t) => (
              <div
                key={t.id}
                className='flex flex-col gap-3 rounded-md border bg-card p-4'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0 flex-1'>
                    <h3 className='truncate text-base font-semibold'>
                      {t.data.name || '(ไม่ระบุชื่อ)'}
                    </h3>
                    {t.data.version && (
                      <p className='mt-0.5 text-xs text-muted-foreground'>
                        เวอร์ชั่น {t.data.version}
                      </p>
                    )}
                  </div>
                  {t.is_active && (
                    <Badge className='bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'>
                      <CheckCircle2 className='mr-1 size-3' />
                      ใช้งาน
                    </Badge>
                  )}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {(t.data.clauses?.length ?? 0).toLocaleString('th-TH')} ข้อ
                  {' · '}
                  {t.data.clauses?.reduce(
                    (n, c) => n + (c.sub?.length ?? 0),
                    0,
                  )}{' '}
                  ข้อย่อย
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button asChild size='sm' variant='outline'>
                    <Link
                      to='/templates/$id'
                      params={{ id: t.id }}
                    >
                      <Edit3 className='size-4' />
                      แก้ไข
                    </Link>
                  </Button>
                  {!t.is_active && (
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => handleActivate(t.id)}
                      disabled={activate.isPending}
                    >
                      <CheckCircle2 className='size-4' />
                      ใช้แบบนี้
                    </Button>
                  )}
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => handleDuplicate(t.id)}
                    disabled={duplicate.isPending}
                  >
                    <Copy className='size-4' />
                    คัดลอก
                  </Button>
                  {!t.is_active && (
                    <Button
                      size='sm'
                      variant='ghost'
                      className='ms-auto text-destructive hover:bg-destructive/10 hover:text-destructive'
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className='size-4' />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Main>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบฟอร์มสัญญา?</AlertDialogTitle>
            <AlertDialogDescription>
              ลบแล้วเรียกคืนไม่ได้ · สัญญาเก่าที่ปริ้นไปแล้วไม่กระทบ
              · ฟอร์มที่ใช้งานอยู่ลบไม่ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ไม่ลบ</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={handleDelete}
            >
              ยืนยันลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
