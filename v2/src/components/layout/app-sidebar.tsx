import { useMemo } from 'react'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useInvoices, daysOverdue } from '@/features/invoices/queries'
import { useContracts, getContractStatus } from '@/features/contracts/queries'
import { useValidationScan } from '@/features/validation/queries'
import { useAuthStore } from '@/stores/auth-store'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import type { SidebarData } from './types'

/** Compute live badge counts from in-flight queries */
function useNavBadges() {
  const { data: invoices } = useInvoices()
  const { data: contracts } = useContracts()
  const { data: issues } = useValidationScan()
  return useMemo(() => {
    const overdueCount = (invoices ?? []).filter((iv) => {
      const st = (iv.status ?? iv.data?.status ?? '').toLowerCase()
      if (st === 'paid' || st === 'voided') return false
      return daysOverdue(iv) > 0
    }).length
    const expiringCount = (contracts ?? []).filter((c) => {
      if (c.data?.cancelled) return false
      return getContractStatus(c.data) === 'expiring'
    }).length
    const validationCount = (issues ?? []).filter((i) => i.severity === 'error').length
    return { overdueCount, expiringCount, validationCount }
  }, [invoices, contracts, issues])
}

/** Build a sidebarData clone with live badge counts injected */
function useSidebarWithBadges(): SidebarData {
  const { overdueCount, expiringCount, validationCount } = useNavBadges()
  return useMemo(() => {
    return {
      ...sidebarData,
      navGroups: sidebarData.navGroups.map((g) => ({
        ...g,
        items: g.items.map((it) => {
          if ('url' in it && it.url === '/invoices' && overdueCount > 0) {
            return { ...it, badge: String(overdueCount) }
          }
          if ('url' in it && it.url === '/contracts/renewals' && expiringCount > 0) {
            return { ...it, badge: String(expiringCount) }
          }
          if ('url' in it && it.url === '/validation' && validationCount > 0) {
            return { ...it, badge: String(validationCount) }
          }
          return it
        }),
      })),
    }
  }, [overdueCount, expiringCount, validationCount])
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const data = useSidebarWithBadges()
  // Real signed-in user — overrides hardcoded default in sidebarData
  const authUser = useAuthStore((s) => s.auth.user)
  const liveUser = authUser
    ? {
        ...data.user,
        name: authUser.email?.split('@')[0] ?? data.user.name,
        email: authUser.email ?? data.user.email,
      }
    : data.user
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={liveUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
