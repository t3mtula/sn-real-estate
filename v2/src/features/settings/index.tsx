import { Outlet, useLocation } from '@tanstack/react-router'
import { Palette, Receipt, Settings2, User, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav, type SidebarNavGroup } from './components/sidebar-nav'

export function Settings() {
  const { pathname } = useLocation()
  const pageTitle = useMemo(() => {
    const titles: Record<string, { title: string; desc: string }> = {
      '/settings/system': { title: 'การตั้งค่าทั่วไป', desc: 'รูปแบบเลข · เกณฑ์แจ้งเตือน · LINE' },
      '/settings/staff': { title: 'พนักงาน', desc: 'จัดการพนักงานในระบบ + บทบาท + ลายเซ็น' },
      '/settings/invoice-settings': { title: 'ใบแจ้งหนี้/ใบเสร็จ', desc: 'ค่าเริ่มต้น VAT · วันครบกำหนด · ข้อความท้ายเอกสาร' },
      '/settings/appearance': { title: 'ธีม', desc: 'ปรับสว่าง/มืด · ฟอนต์ของแอป' },
      '/settings': { title: 'โปรไฟล์', desc: 'บัญชีผู้ใช้ที่เข้าสู่ระบบ' },
    }
    return titles[pathname] ?? { title: 'ตั้งค่า', desc: 'การตั้งค่าระบบและความชอบส่วนตัว' }
  }, [pathname])

  const navGroups: SidebarNavGroup[] = [
    {
      label: 'ระบบ',
      items: [
        {
          title: 'การตั้งค่าทั่วไป',
          href: '/settings/system',
          icon: <Settings2 size={18} />,
        },
      ],
    },
    {
      label: 'ทีมงาน',
      items: [
        {
          title: 'พนักงาน',
          href: '/settings/staff',
          icon: <Users size={18} />,
        },
      ],
    },
    {
      label: 'รูปแบบเอกสาร',
      items: [
        {
          title: 'ใบแจ้งหนี้/ใบเสร็จ',
          href: '/settings/invoice-settings',
          icon: <Receipt size={18} />,
        },
      ],
    },
    {
      label: 'ของฉัน',
      items: [
        {
          title: 'โปรไฟล์',
          href: '/settings',
          icon: <User size={18} />,
        },
        {
          title: 'ธีม',
          href: '/settings/appearance',
          icon: <Palette size={18} />,
        },
      ],
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
          <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
            ตั้งค่า
          </p>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {pageTitle.title}
          </h1>
          <p className='text-muted-foreground'>{pageTitle.desc}</p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav groups={navGroups} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
