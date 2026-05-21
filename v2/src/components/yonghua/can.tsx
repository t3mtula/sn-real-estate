import type { User } from '@supabase/supabase-js'
import { type ReactNode } from 'react'
import { hasAllPermissions, hasAnyPermission, hasPermission, type Permission } from '@/lib/permissions'

interface CanProps {
  user: User | null
  /** single perm (e.g., "contracts.delete") */
  perm?: Permission
  /** any of these (OR) */
  anyOf?: Permission[]
  /** all of these (AND) */
  allOf?: Permission[]
  /** render เมื่อมี permission */
  children: ReactNode
  /** render เมื่อไม่มี permission · default = null */
  fallback?: ReactNode
}

/**
 * <Can> · conditional render ตาม permission
 *
 * Usage:
 *   <Can user={user} perm="contracts.delete">
 *     <Button onClick={delete}>ลบ</Button>
 *   </Can>
 *
 *   <Can user={user} anyOf={['invoices.update', 'invoices.create']}>
 *     <EditButton />
 *   </Can>
 *
 *   <Can user={user} perm="reports.read" fallback={<span>คุณไม่มีสิทธิ์ดูรายงาน</span>}>
 *     <Reports />
 *   </Can>
 */
export function Can({ user, perm, anyOf, allOf, children, fallback = null }: CanProps) {
  let allowed = true
  if (perm && !hasPermission(user, perm)) allowed = false
  if (anyOf && !hasAnyPermission(user, anyOf)) allowed = false
  if (allOf && !hasAllPermissions(user, allOf)) allowed = false
  return <>{allowed ? children : fallback}</>
}
