import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { PropertyFormValues } from "@/features/properties/schema"
import type { PropertyData } from "@/features/properties/types"
import { assembleAddress } from "@/lib/thai-address"

const TABLE = "properties"
const BUCKET = "property-images"

/**
 * Convert form values into the keys we manage in JSONB.
 * Always returns explicit values for every form-controlled key
 * (empty string = clear) — caller is responsible for spreading these
 * over existing v1 fields we don't manage.
 *
 * Note: `address` is auto-assembled from sub-parts (for v1 backward compat display).
 * `province` mirrored to `addr_province` for v1 reports + map.
 */
function valuesToManagedFields(values: PropertyFormValues, pid: number) {
  const assembled = assembleAddress({
    line: values.addrLine,
    subdistrict: values.addrSubdistrict,
    district: values.addrDistrict,
    province: values.addrProvince,
    postal: values.addrPostal,
  })

  return {
    pid,
    name: values.name,
    type: values.type,
    location: values.location,
    // Structured address parts
    addr_line: values.addrLine ?? "",
    addr_subdistrict: values.addrSubdistrict ?? "",
    addr_district: values.addrDistrict ?? "",
    addr_province: values.addrProvince ?? "",
    addr_postal: values.addrPostal ?? "",
    // Backward compat: assembled string + top-level province
    address: assembled,
    province: values.addrProvince ?? "",
    titleDeed: values.titleDeed ?? "",
    area: values.area ?? "",
    owner: values.owner ?? "",
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
      const managed = valuesToManagedFields(values, pid)
      const { error } = await supabase
        .from(TABLE)
        .insert({ id, data: managed })
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
 * Update existing property — MERGES with existing JSONB
 * so v1 fields we don't manage (utilities, addr_no, addr_moo, etc.)
 * are preserved instead of being wiped.
 */
export function useUpdateProperty(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: PropertyFormValues) => {
      // 1. Read existing data blob to preserve v1 fields
      const { data: existing, error: readError } = await supabase
        .from(TABLE)
        .select("data")
        .eq("id", id)
        .single()
      if (readError) throw readError

      const existingData = (existing?.data ?? {}) as PropertyData
      const pid = existingData.pid ?? Number.parseInt(id, 10) ?? Date.now()
      const managed = valuesToManagedFields(values, pid)

      // 2. Merge: existing v1 fields kept · managed fields overwritten
      const merged: PropertyData = { ...existingData, ...managed }

      // 3. Update + return updated row to confirm
      const { data: updated, error } = await supabase
        .from(TABLE)
        .update({ data: merged, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error("ไม่พบทรัพย์สิน หรือไม่มีสิทธิ์แก้ไข (RLS)")
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] })
      qc.invalidateQueries({ queryKey: ["properties", id] })
    },
  })
}
