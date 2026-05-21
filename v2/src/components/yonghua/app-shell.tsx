import { Building2, FileText, Home } from "lucide-react"
import { useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useSession } from "@/lib/auth"
import { CommandPalette } from "@/components/yonghua/command-palette"
import { Sidebar } from "@/components/yonghua/sidebar"
import { TopBar } from "@/components/yonghua/top-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { useUIStore } from "@/stores/ui"

const NAV_ITEMS = [
  { to: "/", label: "หน้าแรก", icon: Home },
  { to: "/properties", label: "ทรัพย์สิน", icon: Building2 },
  { to: "/contracts", label: "สัญญา", icon: FileText },
]

/**
 * AppShell — desktop-first layout for all Yonghua apps
 * - Auth guard (redirect to /login if not signed in)
 * - Sidebar (collapsible · persisted)
 * - TopBar (breadcrumb · user menu · ⌘K)
 * - Content (main · scrollable)
 */
export function AppShell() {
  const { session, loading } = useSession()
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const [paletteOpen, setPaletteOpen] = useState(false)

  if (loading) {
    return (
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <Skeleton className="h-full rounded-none" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <div
      className="grid min-h-screen bg-background text-foreground"
      style={{
        gridTemplateColumns: sidebarCollapsed ? "64px 1fr" : "240px 1fr",
      }}
    >
      <Sidebar collapsed={sidebarCollapsed} items={NAV_ITEMS} brand="SN Real Estate" />
      <div className="flex min-h-0 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
