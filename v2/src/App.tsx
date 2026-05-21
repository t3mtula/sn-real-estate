import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/components/yonghua/app-shell"
import { AuthCallbackPage } from "@/routes/auth-callback"
import { HomePage } from "@/routes/home"
import { LoginPage } from "@/routes/login"
import { PropertiesListPage } from "@/routes/properties-list"
import { PropertyDetailPage } from "@/routes/properties-detail"
import { PropertyEditPage } from "@/routes/properties-edit"
import { PropertyNewPage } from "@/routes/properties-new"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="properties" element={<PropertiesListPage />} />
            <Route path="properties/new" element={<PropertyNewPage />} />
            <Route path="properties/:id" element={<PropertyDetailPage />} />
            <Route path="properties/:id/edit" element={<PropertyEditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  )
}
