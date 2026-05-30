import {
  Activity,
  AlertCircle,
  BarChart3,
  Banknote,
  Building2,
  CalendarClock,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  Landmark,
  Layers,
  Receipt,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react'
import { SnLogo } from '@/components/yonghua/sn-logo'
import { type SidebarData } from '../types'

/**
 * Sidebar nav — จัดเป็น 4 กลุ่มหลัก + ระบบ
 *
 * Grouping rationale (UX):
 *   1. ภาพรวม   — เปิดดูเป็นอันดับแรก · summary level
 *   2. การเงิน   — ใช้บ่อยที่สุดสำหรับพนักงาน (เก็บเงิน · ตามหนี้)
 *   3. สัญญา    — operations รอง · บริหารสัญญา
 *   4. ข้อมูลหลัก — master data · ตั้งครั้งเดียว ใช้ดูเป็นครั้งคราว
 *   5. ระบบ     — admin · ตั้งค่า · log
 *
 * Mirrors Nielsen #4 "Match between system and the real world" — grouped by
 * task (การเงิน, สัญญา) not by entity-type-soup. Miller's 7±2 within each group.
 */
export const sidebarData: SidebarData = {
  user: {
    name: 'Tem',
    email: 't3mtula@sstpconstruction.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'SN Rental Studio',
      logo: SnLogo,
      plan: 'ระบบบริหารสัญญาเช่า',
    },
  ],
  navGroups: [
    {
      title: 'ภาพรวม',
      items: [
        {
          title: 'แดชบอร์ด',
          url: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          title: 'สรุปรายเดือน',
          url: '/reports/monthly',
          icon: TrendingUp,
        },
      ],
    },
    {
      title: 'การเงิน',
      items: [
        {
          title: 'ใบแจ้งหนี้',
          url: '/invoices',
          icon: Receipt,
        },
        {
          title: 'รับเงิน',
          url: '/payments',
          icon: Banknote,
        },
        {
          title: 'ลูกหนี้เกินกำหนด',
          url: '/reports/outstanding',
          icon: AlertCircle,
        },
        {
          title: 'นัดชำระ',
          url: '/reports/follow-up',
          icon: CalendarClock,
        },
        {
          title: 'รายงานอายุหนี้',
          url: '/reports/aging',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'สัญญา',
      items: [
        {
          title: 'สัญญาเช่า',
          url: '/contracts',
          icon: FileText,
        },
        {
          title: 'สัญญาใกล้หมด',
          url: '/contracts/renewals',
          icon: CalendarClock,
        },
        {
          title: 'ฟอร์มสัญญา',
          url: '/templates',
          icon: Layers,
        },
      ],
    },
    {
      title: 'ข้อมูลหลัก',
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
          title: 'มิเตอร์น้ำ/ไฟ',
          url: '/meters',
          icon: Gauge,
        },
      ],
    },
    {
      title: 'ระบบ',
      items: [
        {
          title: 'บันทึกกิจกรรม',
          url: '/activity-log',
          icon: Activity,
        },
        {
          title: 'ตรวจสอบข้อมูล',
          url: '/validation',
          icon: AlertCircle,
        },
        {
          title: 'ตั้งค่า',
          url: '/settings',
          icon: Settings,
        },
      ],
    },
  ],
}
