/**
 * Severity tone → Tailwind class maps.
 *
 * Used by SeverityBadge, DaysRemainingChip, OverdueBadge, MetricDisplay,
 * KpiCard, and left-accent strip helpers across list pages. Centralizing
 * here so all components share one color vocabulary.
 *
 *   success  = ปกติ / healthy / >90 days
 *   info     = upcoming / not yet started
 *   warning  = expiring soon / 31-90 days
 *   urgent   = ≤30 days · needs action this month
 *   critical = overdue / expired / cancelled
 *   muted    = inactive / no data / closed
 */

import type { Severity } from '@/lib/contracts/stats'

export type { Severity }

/** Pill / badge style — bg-tint, border, foreground text. */
export const SEVERITY_BADGE: Record<Severity, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  urgent: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-300',
  critical: 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300',
  muted: 'bg-muted text-muted-foreground border-border',
}

/** Text-only color (no background). */
export const SEVERITY_TEXT: Record<Severity, string> = {
  success: 'text-emerald-700 dark:text-emerald-400',
  info: 'text-sky-700 dark:text-sky-400',
  warning: 'text-amber-700 dark:text-amber-400',
  urgent: 'text-orange-700 dark:text-orange-400',
  critical: 'text-red-700 dark:text-red-400',
  muted: 'text-muted-foreground',
}

/** Left accent strip color (border-l-2). */
export const SEVERITY_STRIP: Record<Severity, string> = {
  success: 'border-l-2 border-l-emerald-500',
  info: 'border-l-2 border-l-sky-500',
  warning: 'border-l-2 border-l-amber-500',
  urgent: 'border-l-2 border-l-orange-500',
  critical: 'border-l-2 border-l-red-500',
  muted: 'border-l-2 border-l-slate-300',
}

/** KPI card outline + tinted bg. */
export const SEVERITY_KPI: Record<Severity, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/5',
  info: 'border-sky-500/30 bg-sky-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  urgent: 'border-orange-500/30 bg-orange-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
  muted: 'border-border',
}

/** Solid fill (e.g., bar segments). */
export const SEVERITY_FILL: Record<Severity, string> = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  urgent: 'bg-orange-500',
  critical: 'bg-red-500',
  muted: 'bg-muted-foreground/30',
}
