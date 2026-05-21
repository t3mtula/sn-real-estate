import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Global UI state · ใช้กับ sidebar / theme / preferences
 * Server state ให้ใช้ TanStack Query · ไม่เก็บใน Zustand
 */

interface UIState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: "yonghua-ui",
    },
  ),
)
