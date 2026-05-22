import { zodResolver } from "@hookform/resolvers/zod"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ThaiAddressInput } from "@/features/properties/components/thai-address-input"
import { uploadPropertyImage } from "@/features/properties/mutations"
import {
  PROPERTY_FORM_DEFAULTS,
  type PropertyFormValues,
  propertyFormSchema,
} from "@/features/properties/schema"
import { PROPERTY_TYPES } from "@/features/properties/types"
import { cn } from "@/lib/utils"

type PropertyFormProps = {
  mode: "create" | "edit"
  /** Existing property ID — required in edit mode for image upload pathing */
  propertyId?: string
  /** Initial form values (prefilled from existing data in edit mode) */
  defaultValues?: PropertyFormValues
  /** Submit handler — passes validated form values */
  onSubmit: (values: PropertyFormValues) => Promise<void> | void
  /** Submitting state from parent mutation */
  submitting?: boolean
  /** Cancel URL (back to detail or list) */
  cancelTo: string
}

export function PropertyForm({
  mode,
  propertyId,
  defaultValues,
  onSubmit,
  submitting = false,
  cancelTo,
}: PropertyFormProps) {
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: defaultValues ?? PROPERTY_FORM_DEFAULTS,
    mode: "onBlur",
  })
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)

  const images = form.watch("images")
  const multiTenant = form.watch("multiTenant")
  const type = form.watch("type")
  const addrLine = form.watch("addrLine")
  const addrSubdistrict = form.watch("addrSubdistrict")
  const addrDistrict = form.watch("addrDistrict")
  const addrProvince = form.watch("addrProvince")
  const addrPostal = form.watch("addrPostal")

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = "" // reset so same file can be re-selected
    if (!files.length) return

    setUploading(true)
    const pathScope = propertyId ?? "pending"
    const uploaded: string[] = []
    let failed = 0

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`ไฟล์ใหญ่เกิน 5MB — ${file.name}`)
        failed += 1
        continue
      }
      try {
        const url = await uploadPropertyImage(file, pathScope)
        uploaded.push(url)
      } catch (err) {
        failed += 1
        toast.error(`อัปโหลด ${file.name} ไม่สำเร็จ`, {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    }

    if (uploaded.length) {
      form.setValue("images", [...images, ...uploaded], { shouldDirty: true })
      toast.success(`อัปโหลดสำเร็จ ${uploaded.length} รูป${failed ? ` · ผิด ${failed} รูป` : ""}`)
    }
    setUploading(false)
  }

  function removeImage(index: number) {
    const next = [...images]
    next.splice(index, 1)
    form.setValue("images", next, { shouldDirty: true })
  }

  async function handleSubmit(values: PropertyFormValues) {
    try {
      await onSubmit(values)
      toast.success(mode === "create" ? "เพิ่มทรัพย์สินสำเร็จ" : "บันทึกการแก้ไขแล้ว")
    } catch (err) {
      toast.error("บันทึกไม่สำเร็จ", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const errors = form.formState.errors
  const isDirty = form.formState.isDirty

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-6"
      onKeyDown={(e) => {
        // Prevent accidental Enter submit in single-line inputs
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault()
        }
      }}
    >
      {/* Basic info */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">
            ชื่อทรัพย์สิน <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="เช่น บ้าน 401/5 บ้านโป่ง"
            aria-invalid={!!errors.name}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </div>

        <div>
          <Label htmlFor="type">
            ประเภท <span className="text-destructive">*</span>
          </Label>
          <Select
            value={type}
            onValueChange={(v) =>
              form.setValue("type", v as PropertyFormValues["type"], { shouldDirty: true })
            }
          >
            <SelectTrigger id="type" className={cn(errors.type && "border-destructive")}>
              <SelectValue placeholder="เลือกประเภท" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type && <FieldError>{errors.type.message}</FieldError>}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="location">
            สถานที่ (โดยย่อ) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="location"
            {...form.register("location")}
            placeholder="เช่น บ้านเช่าซอยผู้ใหญ่บุญ11 มายเฮ้าส์"
          />
          {errors.location && <FieldError>{errors.location.message}</FieldError>}
        </div>

        <div className="sm:col-span-2">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <Label className="text-sm">ที่อยู่</Label>
            <span className="text-xs text-muted-foreground">
              ค้นตำบลหรือรหัสไปรษณีย์ → ระบบ auto-fill ที่เหลือ
            </span>
          </div>
          <ThaiAddressInput
            lineValue={addrLine}
            onLineChange={(line) =>
              form.setValue("addrLine", line, { shouldDirty: true })
            }
            value={{
              subdistrict: addrSubdistrict,
              district: addrDistrict,
              province: addrProvince,
              postal: addrPostal,
            }}
            onChange={(addr) => {
              form.setValue("addrSubdistrict", addr.subdistrict, { shouldDirty: true })
              form.setValue("addrDistrict", addr.district, { shouldDirty: true })
              form.setValue("addrProvince", addr.province, { shouldDirty: true })
              form.setValue("addrPostal", addr.postal, { shouldDirty: true })
            }}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="titleDeed">เลขโฉนด / รายละเอียดที่ดิน</Label>
          <Textarea
            id="titleDeed"
            {...form.register("titleDeed")}
            rows={2}
            placeholder="เช่น โฉนดเลขที่ 21460 ต.บ้านโป่ง อ.บ้านโป่ง จ.ราชบุรี"
          />
        </div>

        <div>
          <Label htmlFor="area">เนื้อที่</Label>
          <Input
            id="area"
            {...form.register("area")}
            placeholder="เช่น 2-2-98.1 ไร่ หรือ 50 ตารางเมตร"
          />
        </div>

        <div>
          <Label htmlFor="owner">เจ้าของ</Label>
          <Input
            id="owner"
            {...form.register("owner")}
            placeholder="ชื่อบุคคล / นิติบุคคล"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 hover:bg-muted/40">
            <Checkbox
              checked={multiTenant}
              onCheckedChange={(checked) =>
                form.setValue("multiTenant", checked === true, { shouldDirty: true })
              }
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">หลายผู้เช่าได้พร้อมกัน</p>
              <p className="text-xs text-muted-foreground">
                เช่น ดาดฟ้าตึก ที่มีเสาส่งสัญญาณหลายค่าย · ที่ดินใหญ่แบ่งล็อก · ระบบจะไม่เตือนว่ามีสัญญาซ้อน
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Images */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <Label className="text-sm">รูปภาพ</Label>
            <p className="text-xs text-muted-foreground">
              อัปโหลดขึ้น Supabase Storage · JPEG/PNG/WebP/HEIC · ไม่เกิน 5MB ต่อรูป
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
            <label className="cursor-pointer">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {uploading ? "กำลังอัปโหลด..." : "เพิ่มรูป"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </Button>
        </div>

        {images.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            ยังไม่มีรูป · กด "เพิ่มรูป" เพื่ออัปโหลด
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((src, i) => (
              <div
                key={`img-${i}-${src.slice(-12)}`}
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                <img src={src} alt="" className="size-full object-cover" loading="lazy" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                  aria-label="ลบรูป"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (isDirty && !confirm("ยังไม่ได้บันทึก · ออกจากหน้านี้?")) return
            navigate({ to: cancelTo })
          }}
          disabled={submitting}
        >
          ยกเลิก
        </Button>
        <Button type="submit" disabled={submitting || uploading}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {mode === "create" ? "เพิ่มทรัพย์สิน" : "บันทึก"}
        </Button>
      </div>

    </form>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-destructive">{children}</p>
}
