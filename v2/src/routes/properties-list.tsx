import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PropertiesListPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ทรัพย์สิน</h1>
          <p className="text-muted-foreground text-sm">
            รายการทรัพย์สินทั้งหมดที่บริษัทมี
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            Phase 1A-1 · scaffold
          </CardTitle>
          <CardDescription>
            หน้านี้คือ placeholder · Phase 1A-2 จะเติม table + filter + search + sort
            (ดู audit Section A2)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Supabase: <code className="rounded bg-muted px-1.5 py-0.5">public.properties</code> · 122 rows</p>
          <p>Type definition: <code className="rounded bg-muted px-1.5 py-0.5">src/features/properties/types.ts</code></p>
        </CardContent>
      </Card>
    </div>
  );
}
