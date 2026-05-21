import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PropertyNewPage() {
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

      <Card>
        <CardHeader>
          <CardTitle>Phase 1A-1 · scaffold</CardTitle>
          <CardDescription>
            Phase 1A-4 จะเติมฟอร์ม (react-hook-form + zod) — ดู audit A4
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Fields: name, type (enum 6), location, address, titleDeed, area, owner, multiTenant, images</p>
        </CardContent>
      </Card>
    </div>
  );
}
