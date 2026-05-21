import { ArrowLeft, Pencil } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/properties" aria-label="กลับ">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">รายละเอียดทรัพย์สิน</h1>
            <p className="text-muted-foreground text-sm">ID: {id ?? "—"}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/properties/${id}/edit`}>
            <Pencil className="size-4" />
            แก้ไข
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1A-1 · scaffold</CardTitle>
          <CardDescription>
            Phase 1A-3 จะเติม detail view + image gallery + contracts list (audit A3)
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>จะแสดง: ประเภท · ที่อยู่ · พื้นที่ · เลขโฉนด · รูปภาพ · สัญญาที่เกี่ยวข้อง</p>
        </CardContent>
      </Card>
    </div>
  );
}
