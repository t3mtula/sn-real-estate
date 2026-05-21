import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PropertyEditPage() {
  const { id } = useParams<{ id: string }>();

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
          <p className="text-muted-foreground text-sm">ID: {id ?? "—"}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1A-1 · scaffold</CardTitle>
          <CardDescription>
            Phase 1A-4 จะเติมฟอร์มเดียวกับ add (unified — feedback_unify_forms lesson)
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>ใช้ form component เดียวกับ add page · prefill values จาก existing property</p>
        </CardContent>
      </Card>
    </div>
  );
}
