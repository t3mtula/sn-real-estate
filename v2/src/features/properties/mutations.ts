import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { PropertyFormValues } from "@/features/properties/schema"
import type { PropertyData } from "@/features/properties/types"

const TABLE = "properties"
const BUCKET = "property-images"

/** Convert form values to PropertyData blob (strip empty optionals) */
function valuesToData(values: PropertyFormValues, pid: number): PropertyData {
  return {
    pid,
    name: values.name,
    type: values.type,
    location: values.location,
    ...(values.address ? { address: values.address } : {}),
    ...(values.province ? { province: values.province, addr_province: values.province } : {}),
    ...(values.titleDeed ? { titleDeed: values.titleDeed } : {}),
    ...(values.area ? { area: values.area } : {}),
    ...(values.owner ? { owner: values.owner } : {}),
    multiTenant: values.multiTenant,
    images: values.images,
  }
}

/**
 * Upload single image to Supabase Storage
 * Returns the public URL (works without auth since bucket is public)
 */
export async function uploadPropertyImage(file: File, propertyId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext) ? ext : "jpg"
  const stamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${propertyId}/${stamp}-${rand}.${safeExt}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || "image/jpeg",
      upsert: false,
    })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Create new property
 */
export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      const pid = Date.now()
      const id = String(pid)
      const data = valuesToData(values, pid)
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data })
        .select("id")
        .single()
      if (error) throw error
      return { id, pid }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] })
    },
  })
}

/**
 * Update existing property
 */
export function useUpdateProperty(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      // Read existing pid to preserve it
      const { data: existing } = await supabase
        .from(TABLE)
        .select("data")
        .eq("id", id)
        .single()
      const existingData = existing?.data as PropertyData | undefined
      const pid = existingData?.pid ?? Number.parseInt(id, 10) ?? Date.now()

      const data = valuesToData(values, pid)
      const { error } = await supabase
        .from(TABLE)
        .update({ data, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] })
      qc.invalidateQueries({ queryKey: ["properties", id] })
    },
  })
}
