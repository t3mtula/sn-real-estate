import {
  Building2,
  CreditCard,
  FileText,
  GalleryVerticalEnd,
  Landmark,
  Palette,
  Settings,
  UserCog,
  Users,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Tem',
    email: 't3mtula@sstpconstruction.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'SN Real Estate',
      logo: GalleryVerticalEnd,
      plan: 'v2 (in development)',
    },
  ],
  navGroups: [
    {
      title: 'หลัก',
      items: [
        {
          title: 'ทรัพย์สิน',
          url: '/properties',
          icon: Building2,
        },
        {
          title: 'ผู้เช่า',
          url: '/tenants',
          icon: Users,
        },
        {
          title: 'ผู้ให้เช่า',
          url: '/landlords',
          icon: Landmark,
        },
        {
          title: 'บัญชีธนาคาร',
          url: '/bank-accounts',
          icon: CreditCard,
        },
        {
          title: 'สัญญาเช่า',
          url: '/contracts',
          icon: FileText,
        },
      ],
    },
    {
      title: 'อื่น',
      items: [
        {
          title: 'ตั้งค่า',
          icon: Settings,
          items: [
            {
              title: 'โปรไฟล์',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'หน้าตา',
              url: '/settings/appearance',
              icon: Palette,
            },
          ],
        },
      ],
    },
  ],
}
