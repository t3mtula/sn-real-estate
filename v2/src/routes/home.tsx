import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/lib/auth"
import { fmtThaiLong, todayBE } from "@/lib/thai-date"

export function HomePage() {
  const { user } = useSession()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">หน้าแรก</h1>
        <p className="text-muted-foreground">
          ยินดีต้อนรับ {user?.email ?? "ผู้ใช้"} · {todayBE()}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>SN Real Estate — v2</CardTitle>
          <CardDescription>
            ระบบบริหารทรัพย์สิน + สัญญาเช่า · กำลังพัฒนา (Phase 0 พร้อมแล้ว · Phase 1 audit ต่อ)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="font-medium text-foreground">วันนี้</div>
            <p className="mt-1 text-muted-foreground">{fmtThaiLong(new Date())}</p>
          </div>
          <div>
            <div className="font-medium text-foreground">เมนู</div>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>· ทรัพย์สิน (กำลังทำใน Phase 1A)</li>
              <li>· สัญญาเช่า (Phase 1B)</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-foreground">ลองกด ⌘K</div>
            <p className="mt-1 text-muted-foreground">
              Command palette สำหรับ search/navigation/actions
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
