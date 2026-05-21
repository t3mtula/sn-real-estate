import type { User } from '@supabase/supabase-js'

/**
 * Permission / RBAC helper
 *
 * Permission format: "resource.action" (e.g., "contracts.delete", "invoices.read")
 * Wildcards supported:
 *   - "*"             = everything
 *   - "contracts.*"   = all actions on contracts
 *   - "*.read"        = read any resource
 *
 * Setup roles for app:
 *   1. ตั้ง role ของ user ใน Supabase Auth → Users → Edit → raw_app_meta_data:
 *      { "role": "admin" }  หรือ { "roles": ["admin", "accountant"] }
 *   2. ปรับ ROLE_PERMISSIONS ด้านล่างตาม app
 *
 * Usage:
 *   const { user } = useSession()
 *   if (hasPermission(user, 'contracts.delete')) showDeleteButton()
 *
 *   // Guard component:
 *   <Can perm="contracts.delete" user={user}><DeleteButton/></Can>
 */

export type Permission = string // "resource.action"

/**
 * Default role-permissions matrix
 *
 * แต่ละ app สามารถ override โดย import + extend หรือ replace
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ['*'],
  accountant: ['invoices.*', 'reports.*', 'customers.read', 'contracts.read'],
  staff: ['contracts.*', 'invoices.read', 'invoices.create', 'customers.*'],
  viewer: ['*.read'],
}

export function getUserRoles(user: User | null): string[] {
  if (!user) return []
  const meta = user.app_metadata as Record<string, unknown> | undefined
  if (Array.isArray(meta?.roles)) return meta.roles as string[]
  if (typeof meta?.role === 'string') return [meta.role]
  return []
}

export function getUserPermissions(user: User | null): Set<Permission> {
  const roles = getUserRoles(user)
  const perms = new Set<Permission>()
  for (const role of roles) {
    const list = ROLE_PERMISSIONS[role] ?? []
    for (const p of list) perms.add(p)
  }
  return perms
}

/**
 * Check ว่า perm "contracts.delete" ตรงกับ pattern "contracts.*" หรือ "*"
 */
function matches(perm: Permission, pattern: Permission): boolean {
  if (pattern === perm) return true
  if (pattern === '*') return true
  const [pRes, pAct] = pattern.split('.')
  const [res, act] = perm.split('.')
  if (pRes === '*' && pAct === act) return true
  if (pRes === res && pAct === '*') return true
  return false
}

/**
 * hasPermission(user, "contracts.delete") → boolean
 */
export function hasPermission(user: User | null, perm: Permission): boolean {
  if (!user) return false
  const perms = getUserPermissions(user)
  for (const p of perms) {
    if (matches(perm, p)) return true
  }
  return false
}

/**
 * Has ANY of the listed permissions (OR logic)
 */
export function hasAnyPermission(user: User | null, perms: Permission[]): boolean {
  return perms.some((p) => hasPermission(user, p))
}

/**
 * Has ALL of the listed permissions (AND logic)
 */
export function hasAllPermissions(user: User | null, perms: Permission[]): boolean {
  return perms.every((p) => hasPermission(user, p))
}

/**
 * Throw if not authorized · ใช้ใน mutation functions
 */
export function requirePermission(user: User | null, perm: Permission): void {
  if (!hasPermission(user, perm)) {
    throw new PermissionDeniedError(perm)
  }
}

export class PermissionDeniedError extends Error {
  constructor(perm: Permission) {
    super(`สิทธิ์ไม่เพียงพอ (need: ${perm})`)
    this.name = 'PermissionDeniedError'
  }
}
