import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Property, PropertyData } from "@/features/properties/types"

const TABLE = "properties"

/**
 * Fetch all properties · sorted by updated_at desc
 */
export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async (): Promise<Property[]> => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, data, created_at, updated_at")
        .order("updated_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as Property[]
    },
  })
}

/**
 * Fetch single property by ID
 */
export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ["properties", id],
    queryFn: async (): Promise<Property | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, data, created_at, updated_at")
        .eq("id", id)
        .maybeSingle()
      if (error) throw error
      return data as Property | null
    },
    enabled: !!id,
  })
}

/**
 * Get property display name with fallback
 */
export function getPropertyName(p: PropertyData | undefined): string {
  return p?.name?.trim() || "(ไม่มีชื่อ)"
}

/**
 * Get province display (prefer province field, fall back to addr_province)
 */
export function getPropertyProvince(p: PropertyData | undefined): string {
  return (p?.province ?? p?.addr_province ?? "").trim() || "—"
}

/**
 * Get short address for table display
 */
export function getPropertyAddressShort(p: PropertyData | undefined): string {
  if (!p) return ""
  // Prefer location, fall back to address, then titleDeed
  return (p.location ?? p.address ?? p.titleDeed ?? "").trim() || "—"
}

/**
 * ชื่ออาคาร/ที่อยู่ย่อของห้อง สำหรับโชว์ต่อท้ายชื่อทรัพย์ + ค้นเจอในหน้าบิล/สัญญา
 * (เหมือนบรรทัดสองในหน้าทรัพย์ แต่คืน "" ถ้าว่าง — ไม่เอา "—" มาเกะกะ)
 */
export function propertyBuildingText(p: PropertyData | undefined): string {
  const v = getPropertyAddressShort(p)
  return v === "—" ? "" : v
}

/**
 * Map pid (เลขทรัพย์ legacy) → PropertyData · ใช้ lookup ชื่ออาคารของห้อง
 * จากบิล/สัญญา ที่อ้างทรัพย์ด้วย pid (invoice.data.pid / contract.data.pid_property)
 */
export function usePropertyByPid(): Map<number, PropertyData> {
  const { data } = useProperties()
  return useMemo(() => {
    const m = new Map<number, PropertyData>()
    for (const p of data ?? []) {
      const pid = p.data?.pid
      if (typeof pid === "number") m.set(pid, p.data)
    }
    return m
  }, [data])
}

/**
 * Image count (handles undefined safely)
 */
export function getPropertyImageCount(p: PropertyData | undefined): number {
  return p?.images?.length ?? 0
}
