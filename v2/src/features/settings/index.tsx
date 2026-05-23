import { Outlet } from '@tanstack/react-router'
import { Building2, FileText, Monitor, Palette, Receipt, Settings2, UserCog, Users } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useContractTemplates } from '@/features/templates/queries'
import { SidebarNav } from './components/sidebar-nav'

export function Settings() {
  const { data: templates } = useContractTemplates()
  const activeTemplate = templates?.find((t) => t.is_active) ?? templates?.[0]
  const templateHref = activeTemplate
    ? `/settings/templates/${activeTemplate.id}`
    : '/settings/templates/new'

  const sidebarNavItems = [
    {
      title: 'ข้อมูลบริษัท',
      href: '/settings/company',
      icon: <Building2 size={18} />,
    },
    {
      title: 'พนักงาน',
      href: '/settings/staff',
      icon: <Users size={18} />,
    },
    {
      title: 'การแสดงผล',
      href: '/settings/display',
      icon: <Monitor size={18} />,
    },
    {
      title: 'ใบแจ้งหนี้',
      href: '/settings/invoice-settings',
      icon: <Receipt size={18} />,
    },
    {
      title: 'ฟอร์มสัญญา',
      href: templateHref,
      icon: <FileText size={18} />,
    },
    {
      title: 'ระบบ',
      href: '/settings/system',
      icon: <Settings2 size={18} />,
    },
    {
      title: 'บัญชีผู้ใช้',
      href: '/settings',
      icon: <UserCog size={18} />,
    },
    {
      title: 'หน้าตา',
      href: '/settings/appearance',
      icon: <Palette size={18} />,
    },
  ]

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            ตั้งค่า
          </h1>
          <p className='text-muted-foreground'>
            บัญชีผู้ใช้และการแสดงผลของแอป
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
