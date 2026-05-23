import { useRef, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaff } from '../queries'
import { useCreateStaff, useDeleteStaff, useUpdateStaff } from '../mutations'
import type { StaffMember } from '../queries'

const ROLE_LABEL: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  manager: 'ผู้จัดการ',
  staff: 'พนักงาน',
}

function StaffRow({ member }: { member: StaffMember }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.name)
  const [role, setRole] = useState(member.role)
  const [sigImg, setSigImg] = useState(member.signature_img ?? '')
  const sigRef = useRef<HTMLInputElement>(null)
  const update = useUpdateStaff(member.id)
  const del = useDeleteStaff()

  function handleSigChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 400_000) { toast.error('รูปใหญ่เกิน 400 KB'); return }
    const reader = new FileReader()
    reader.onload = () => setSigImg(reader.result as string)
    reader.readAsDataURL(f)
  }

  function handleSave() {
    update.mutate(
      { name, role: role as StaffMember['role'], signature_img: sigImg || null },
      {
        onSuccess: () => { toast.success('บันทึกแล้ว'); setEditing(false) },
        onError: (e) => toast.error('บันทึกไม่สำเร็จ', { description: String(e) }),
      },
    )
  }

  function handleDelete() {
    del.mutate(member.id, {
      onSuccess: () => toast.success('ลบพนักงานแล้ว'),
      onError: (e) => toast.error('ลบไม่สำเร็จ', { description: String(e) }),
    })
  }

  if (!editing) {
    return (
      <div className='flex items-center gap-3 rounded-md border bg-card px-4 py-3'>
        {sigImg
          ? <img src={sigImg} alt='sig' className='h-10 w-16 rounded border object-contain' />
          : <div className='flex h-10 w-16 items-center justify-center rounded border bg-muted text-xs text-muted-foreground'>ไม่มีลายเซ็น</div>
        }
        <div className='flex-1'>
          <p className='font-medium'>{member.name}</p>
          <Badge variant='outline' className='mt-0.5 text-xs'>{ROLE_LABEL[member.role] ?? member.role}</Badge>
        </div>
        <Button size='sm' variant='outline' onClick={() => setEditing(true)}>แก้ไข</Button>
        <Button size='sm' variant='ghost' className='text-destructive hover:bg-destructive/10 hover:text-destructive' onClick={handleDelete} disabled={del.isPending}>
          <Trash2 className='size-3.5' />
        </Button>
      </div>
    )
  }

  return (
    <div className='rounded-md border bg-card p-4 space-y-3'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label>ชื่อ-นามสกุล</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className='space-y-1'>
          <Label>ตำแหน่ง</Label>
          <Select value={role} onValueChange={(v) => setRole(v as StaffMember['role'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='admin'>ผู้ดูแลระบบ</SelectItem>
              <SelectItem value='manager'>ผู้จัดการ</SelectItem>
              <SelectItem value='staff'>พนักงาน</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1 sm:col-span-2'>
          <Label>ลายเซ็น</Label>
          <div className='flex items-center gap-3'>
            {sigImg
              ? <img src={sigImg} alt='sig' className='h-12 w-24 rounded border object-contain' />
              : <div className='flex h-12 w-24 items-center justify-center rounded border bg-muted text-xs text-muted-foreground'>ไม่มี</div>
            }
            <div>
              <Button variant='outline' size='sm' onClick={() => sigRef.current?.click()}>เลือกรูป</Button>
              {sigImg && <Button variant='ghost' size='sm' className='ml-2 text-destructive' onClick={() => setSigImg('')}>ลบ</Button>}
              <p className='text-xs text-muted-foreground'>PNG/JPG · ไม่เกิน 400 KB</p>
            </div>
            <input ref={sigRef} type='file' accept='image/*' className='hidden' onChange={handleSigChange} />
          </div>
        </div>
      </div>
      <div className='flex gap-2'>
        <Button size='sm' onClick={handleSave} disabled={update.isPending}>
          {update.isPending && <Loader2 className='size-3.5 animate-spin' />}
          บันทึก
        </Button>
        <Button size='sm' variant='ghost' onClick={() => setEditing(false)}>ยกเลิก</Button>
      </div>
    </div>
  )
}

function AddStaffForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'staff'>('staff')
  const create = useCreateStaff()

  function handleSave() {
    if (!name.trim()) { toast.error('ใส่ชื่อก่อน'); return }
    create.mutate({ name: name.trim(), role }, {
      onSuccess: () => { toast.success('เพิ่มพนักงานแล้ว'); onDone() },
      onError: (e) => toast.error('เพิ่มไม่สำเร็จ', { description: String(e) }),
    })
  }

  return (
    <div className='rounded-md border border-dashed bg-muted/30 p-4 space-y-3'>
      <p className='text-sm font-semibold'>เพิ่มพนักงานใหม่</p>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label>ชื่อ-นามสกุล</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='ชื่อ นามสกุล' />
        </div>
        <div className='space-y-1'>
          <Label>ตำแหน่ง</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='admin'>ผู้ดูแลระบบ</SelectItem>
              <SelectItem value='manager'>ผู้จัดการ</SelectItem>
              <SelectItem value='staff'>พนักงาน</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className='flex gap-2'>
        <Button size='sm' onClick={handleSave} disabled={create.isPending}>
          {create.isPending && <Loader2 className='size-3.5 animate-spin' />}
          เพิ่ม
        </Button>
        <Button size='sm' variant='ghost' onClick={onDone}>ยกเลิก</Button>
      </div>
    </div>
  )
}

export function StaffSettingsSection() {
  const { data: staff, isLoading } = useStaff()
  const [adding, setAdding] = useState(false)

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between'>
        <div>
          <h3 className='text-lg font-medium'>พนักงาน</h3>
          <p className='text-sm text-muted-foreground'>รายชื่อพนักงาน ตำแหน่ง และลายเซ็น</p>
        </div>
        <Button size='sm' onClick={() => setAdding(true)} disabled={adding}>
          <Plus className='size-4' />เพิ่มพนักงาน
        </Button>
      </div>
      <Separator />

      {isLoading && (
        <div className='space-y-2'>
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      )}

      {adding && <AddStaffForm onDone={() => setAdding(false)} />}

      <div className='space-y-2'>
        {staff?.map((m) => <StaffRow key={m.id} member={m} />)}
        {!isLoading && staff?.length === 0 && !adding && (
          <p className='text-sm text-muted-foreground'>ยังไม่มีพนักงาน · กด "เพิ่มพนักงาน" เพื่อเริ่ม</p>
        )}
      </div>

      <Separator />
      <div className='rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1'>
        <p className='font-semibold'>สิทธิ์การใช้งาน</p>
        <p>ผู้ดูแลระบบ — ทุกอย่าง รวมถึงตั้งค่าและจัดการพนักงาน</p>
        <p>ผู้จัดการ — ดู/สร้าง/แก้ไข/ยกเลิกใบแจ้งหนี้ · export ข้อมูล</p>
        <p>พนักงาน — ดูข้อมูลและพิมพ์เอกสารเท่านั้น</p>
      </div>
    </div>
  )
}
