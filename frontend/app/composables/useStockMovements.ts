import { toast } from 'vue-sonner'

interface StockMovement {
  id: number
  product_id: number
  change: number
  new_quantity: number
  reason: string
  reference?: string | null
  user_id?: number | null
  created_at: string
  product?: { name: string; sku: string; unit: string }
  user?: { name: string; email: string }
}

interface MovementFilters {
  startDate?: string
  endDate?: string
  productId?: string
  reason?: string
  search?: string
}

interface CreateMovementInput {
  productId: number
  change: number
  reason: 'purchase' | 'adjust' | 'damage'
  reference?: string
}

interface MovementSummary {
  total_movements: number
  by_sale: number
  by_purchase: number
  by_adjustment: number
  by_damage: number
  net_change: number
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const useStockMovements = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const movements = ref<StockMovement[]>([])
  const loading = ref(false)
  const selectedMovement = ref<StockMovement | null>(null)
  const summary = ref<MovementSummary | null>(null)

  const fetchMovements = async (filters?: MovementFilters): Promise<void> => {
    loading.value = true
    try {
      const query = new URLSearchParams()
      if (filters?.startDate) query.append('startDate', filters.startDate)
      if (filters?.endDate) query.append('endDate', filters.endDate)
      if (filters?.productId) query.append('productId', filters.productId)
      if (filters?.reason) query.append('reason', filters.reason)
      if (filters?.search) query.append('search', filters.search)

      const qs = query.toString()
      const url = qs
        ? `${apiBase}/api/stock-movements?${qs}`
        : `${apiBase}/api/stock-movements`

      const res = await $apiFetch<ApiResponse<StockMovement[]>>(url, { credentials: 'include' })
      movements.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch stock movements')
    } finally {
      loading.value = false
    }
  }

  const fetchMovement = async (id: number): Promise<StockMovement | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<StockMovement>>(
        `${apiBase}/api/stock-movements/${id}`,
        { credentials: 'include' }
      )
      selectedMovement.value = res.data
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch movement details')
    } finally {
      loading.value = false
    }
  }

  const fetchMovementsByProduct = async (productId: number): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<StockMovement[]>>(
        `${apiBase}/api/stock-movements/product/${productId}`,
        { credentials: 'include' }
      )
      movements.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch product movements')
    } finally {
      loading.value = false
    }
  }

  const fetchMovementsByDateRange = async (startDate: Date, endDate: Date): Promise<void> => {
    loading.value = true
    try {
      const query = new URLSearchParams({
        startDate: startDate.toISOString().split('T')[0]!,
        endDate: endDate.toISOString().split('T')[0]!
      })

      const res = await $apiFetch<ApiResponse<StockMovement[]>>(
        `${apiBase}/api/stock-movements/date-range?${query.toString()}`,
        { credentials: 'include' }
      )
      movements.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch movements for date range')
    } finally {
      loading.value = false
    }
  }

  const createAdjustment = async (data: CreateMovementInput): Promise<StockMovement | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<StockMovement>>(
        `${apiBase}/api/stock-movements`,
        { method: 'POST', body: data, credentials: 'include' }
      )
      movements.value.unshift(res.data)
      toast.success(res.message)
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create stock adjustment')
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchSummary = async (): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<MovementSummary>>(
        `${apiBase}/api/stock-movements/summary`,
        { credentials: 'include' }
      )
      summary.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch movement summary')
    } finally {
      loading.value = false
    }
  }

  const exportReport = (startDate?: Date, endDate?: Date): void => {
    const query = new URLSearchParams()
    if (startDate) query.append('startDate', startDate.toISOString().split('T')[0]!)
    if (endDate) query.append('endDate', endDate.toISOString().split('T')[0]!)

    const qs = query.toString()
    const url = qs
      ? `${apiBase}/api/stock-movements/export?${qs}`
      : `${apiBase}/api/stock-movements/export`

    window.open(url, '_blank')
    toast.success('Stock movements report downloaded')
  }

  return {
    movements,
    loading,
    selectedMovement,
    summary,
    fetchMovements,
    fetchMovement,
    fetchMovementsByProduct,
    fetchMovementsByDateRange,
    createAdjustment,
    fetchSummary,
    exportReport
  }
}