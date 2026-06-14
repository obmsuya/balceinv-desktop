interface DashboardData {
  summary: {
    userCount: number
    productCount: number
    saleCount: number
    totalRevenue: number
  }
  dailySales: Array<{ date: string; total: number }>
  topProducts: Array<{ id: number; name: string; sku: string; totalSold: number }>
}

export const useDashboard = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  return useAsyncData<DashboardData>('dashboard', () =>
    $apiFetch<DashboardData>(`${apiBase}/api/dashboard`, { credentials: 'include' })
  )
}