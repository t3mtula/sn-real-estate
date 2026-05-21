import { LogOut, Search } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut, useSession } from "@/lib/auth"

interface TopBarProps {
  onOpenPalette: () => void
}

export function TopBar({ onOpenPalette }: TopBarProps) {
  const { user } = useSession()
  const initials = (user?.email ?? "?").slice(0, 1).toUpperCase()

  async function handleSignOut() {
    try {
      await signOut()
      toast.success("ออกจากระบบแล้ว")
    } catch (err) {
      toast.error("ออกจากระบบไม่สำเร็จ", {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-muted-foreground"
        onClick={onOpenPalette}
      >
        <Search className="size-4" />
        <span className="ml-2">ค้นหา...</span>
        <kbd className="ml-4 hidden rounded border bg-muted px-1.5 py-0.5 text-xs sm:inline">
          ⌘K
        </kbd>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="User menu">
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{user?.email ?? "Guest"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 size-4" />
            ออกจากระบบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
