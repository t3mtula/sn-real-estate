import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import {
  ShortcutsHelpDialog,
  useKeyboardShortcuts,
} from '@/hooks/use-keyboard-shortcuts'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

/** Inner component — must be inside SearchProvider/router so the hook can read context. */
function GlobalShortcuts() {
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts()
  return <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  // Default to expanded on first visit · honor user toggle via cookie afterwards
  // On mobile (<768 px) always start collapsed regardless of cookie
  const stored = getCookie('sidebar_state')
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768
  const defaultOpen = isMobileViewport ? false : (stored === null || stored === '' ? true : stored !== 'false')
  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <GlobalShortcuts />
          <AppSidebar />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-data-[layout=fixed]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
