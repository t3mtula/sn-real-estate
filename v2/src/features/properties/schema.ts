import { z } from "zod"
import { PROPERTY_TYPES } from "@/features/properties/types"

const typeValues = PROPERTY_TYPES.map((t) => t.value) as [
  (typeof PROPERTY_TYPES)[number]["value"],
  ...(typeof PROPERTY_TYPES)[number]["value"][],
]

/**
 * Property form schema — locked to audit A4 + Tem's decision (type = enum, no free-text)
 */
export const propertyFormSchema = z.object({
  name: z.string().trim().min(1, "ระบุชื่อทรัพย์สิน").max(200),
  type: z.enum(typeValues, { message: "เลือกประเภททรัพย์สิน" }),
  location: z.string().trim().min(1, "ระบุสถานที่").max(500),
  address: z.string().trim().max(1000),
  province: z.string().trim().max(100),
  titleDeed: z.string().trim().max(500),
  area: z.string().trim().max(200),
  owner: z.string().trim().max(200),
  multiTenant: z.boolean(),
  images: z.array(z.string().url().or(z.string().startsWith("data:"))),
})

export type PropertyFormValues = z.infer<typeof propertyFormSchema>

export const PROPERTY_FORM_DEFAULTS: PropertyFormValues = {
  name: "",
  type: "shophouse",
  location: "",
  address: "",
  province: "",
  titleDeed: "",
  area: "",
  owner: "",
  multiTenant: false,
  images: [],
}
