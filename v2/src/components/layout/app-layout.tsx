import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

type AppLayoutProps = {
  activeKey?: string;
  title: string;
  eyebrow?: string;
  user: { name: string; email: string };
  children: ReactNode;
};

export function AppLayout({
  activeKey,
  title,
  eyebrow,
  user,
  children,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeKey={activeKey} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-6">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
              ออก
            </Button>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
