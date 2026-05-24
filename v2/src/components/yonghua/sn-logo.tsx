/**
 * SnLogo — brand mark สำหรับ SN Rental Studio
 *
 * Rounded square สีน้ำเงิน + ตัวอักษร "SN" สีขาว · ใช้เป็น sidebar logo และ
 * favicon · ตรง shape เดียวกันให้ brand consistent ทุกที่
 *
 * อ่าน className ได้แบบเดียวกับ lucide-react icon เพื่อเสียบใน sidebar-data.ts
 * ที่ teams[].logo expect React.ElementType
 */
import type { SVGProps } from 'react'

export function SnLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      className={className}
      {...props}
    >
      <rect width='24' height='24' rx='5' fill='#1d4ed8' />
      <text
        x='12'
        y='17'
        textAnchor='middle'
        fontFamily='system-ui, -apple-system, "Segoe UI", sans-serif'
        fontWeight='800'
        fontSize='13'
        fill='white'
        letterSpacing='-0.5'
      >
        SN
      </text>
    </svg>
  )
}
