import { ArrowLeft } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PropertyForm } from "@/features/properties/components/property-form"
import { useUpdateProperty } from "@/features/properties/mutations"
import { useProperty } from "@/features/properties/queries"
import { PROPERTY_FORM_DEFAULTS, type PropertyFormValues } from "@/features/properties/schema"
import type { PropertyTypeValue } from "@/features/properties/types"

const VALID_TYPES = new Set<string>([
  "shophouse",
  "land_with_house",
  "vacant_land",
  "rooftop_tower",
  "apartment",
  "other",
])

function coerceType(value: string | undefined): PropertyTypeValue {
  if (value && VALID_TYPES.has(value)) return value as PropertyTypeValue
  return "other"
}

export function PropertyEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: property, isLoading, error } = useProperty(id)
  const update = useUpdateProperty(id ?? "")
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="self-start">
          <Link to="/properties">
            <ArrowLeft className="size-4" />
            กลับ
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>ไม่พบทรัพย์สิน</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {error
              ? `โหลดข้อมูลไม่สำเร็จ — ${error instanceof Error ? error.message : String(error)}`
              : `ทรัพย์สิน ID ${id} ไม่มีในระบบ`}
          </CardContent>
        </Card>
      </div>
    )
  }

  const p = property.data
  const defaults: PropertyFormValues = {
    ...PROPERTY_FORM_DEFAULTS,
    name: p.name ?? "",
    type: coerceType(p.type),
    location: p.location ?? "",
    address: p.address ?? "",
    province: p.province ?? p.addr_province ?? "",
    titleDeed: p.titleDeed ?? "",
    area: p.area ?? "",
    owner: p.owner ?? "",
    multiTenant: p.multiTenant === true,
    images: (p.images ?? []).filter(Boolean),
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/properties/${id}`} aria-label="กลับ">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">แก้ไขทรัพย์สิน</h1>
          <p className="text-muted-foreground text-sm">{p.name || `ID: ${id}`}</p>
        </div>
      </header>

      <div className="max-w-4xl">
        <PropertyForm
          mode="edit"
          propertyId={id}
          defaultValues={defaults}
          cancelTo={`/properties/${id}`}
          submitting={update.isPending}
          onSubmit={async (values) => {
            await update.mutateAsync(values)
            navigate(`/properties/${id}`)
          }}
        />
      </div>
    </div>
  )
}
