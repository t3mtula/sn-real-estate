import { Building2, FileText, Home, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  href: string;
};

const navItems: NavItem[] = [
  { key: "home", label: "หน้าแรก", icon: <Home className="size-4" />, href: "/" },
  {
    key: "contracts",
    label: "สัญญา",
    icon: <FileText className="size-4" />,
    href: "/contracts",
  },
  {
    key: "properties",
    label: "ทรัพย์สิน",
    icon: <Building2 className="size-4" />,
    href: "/properties",
  },
];

type SidebarProps = {
  activeKey?: string;
};

export function Sidebar({ activeKey = "home" }: SidebarProps) {
  return (
    <aside className="hidden w-[228px] shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="size-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">SN Real Estate</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-1.5 py-3">
        {navItems.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
              )}
              <span className={cn(isActive ? "text-primary" : "text-muted-foreground")}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-1.5 py-2">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <Settings className="size-4" />
          ตั้งค่า
        </button>
      </div>
    </aside>
  );
}
