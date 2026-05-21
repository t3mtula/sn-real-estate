import { ArrowLeft } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { PropertyForm } from "@/features/properties/components/property-form"
import { useCreateProperty } from "@/features/properties/mutations"

export function PropertyNewPage() {
  const create = useCreateProperty()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/properties" aria-label="กลับ">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">เพิ่มทรัพย์สินใหม่</h1>
          <p className="text-muted-foreground text-sm">กรอกข้อมูลทรัพย์สิน</p>
        </div>
      </header>

      <div className="max-w-4xl">
        <PropertyForm
          mode="create"
          cancelTo="/properties"
          submitting={create.isPending}
          onSubmit={async (values) => {
            const { id } = await create.mutateAsync(values)
            navigate(`/properties/${id}`)
          }}
        />
      </div>
    </div>
  )
}
