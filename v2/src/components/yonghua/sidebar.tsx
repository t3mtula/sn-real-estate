import { Home, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { NavLink } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"

/**
 * Sidebar · collapsible · persisted state ใน zustand
 * แต่ละ app override `nav items` ของตัวเอง
 */
interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const DEFAULT_NAV: NavItem[] = [{ to: "/", label: "หน้าหลัก", icon: Home }]

interface SidebarProps {
  collapsed: boolean
  items?: NavItem[]
  brand?: string
}

export function Sidebar({ collapsed, items = DEFAULT_NAV, brand = "Yonghua" }: SidebarProps) {
  const toggle = useUIStore((s) => s.toggleSidebar)

  return (
    <aside className="flex flex-col border-r bg-card">
      <div
        className={cn(
          "flex h-14 items-center border-b px-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && <div className="font-semibold tracking-tight">{brand}</div>}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-0",
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <Separator />
      <div className="p-2 text-xs text-muted-foreground">
        {!collapsed && <div className="px-3 py-2">v2 · in development</div>}
      </div>
    </aside>
  )
}
