import { toast } from 'vue-sonner'

export interface Discount {
  id: number
  name: string
  product_id: number | null
  discount_type: 'percent' | 'fixed'
  value: number
  starts_at: string
  ends_at: string
  is_active: boolean
  created_by: number
  created_at?: string
  updated_at?: string
  product?: {
    id: number
    name: string
    sku: string
  } | null
  creator?: {
    id: number
    name: string
  }
}

export interface AppliedDiscount {
  discount_id: number
  name: string
  discount_type: 'percent' | 'fixed'
  value: number
  final_price: number
}

interface CreateDiscountInput {
  name: string
  product_id?: number | null
  discount_type: 'percent' | 'fixed'
  value: number
  starts_at: string
  ends_at: string
}

interface UpdateDiscountInput {
  name: string
  product_id?: number | null
  discount_type: 'percent' | 'fixed'
  value: number
  starts_at: string
  ends_at: string
  is_active: boolean
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const useDiscounts = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const discounts = ref<Discount[]>([])
  const loading = ref(false)

  const fetchDiscounts = async (): Promise<void> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Discount[]>>(
        `${apiBase}/api/discounts`,
        { credentials: 'include' as const },
      )
      discounts.value = response.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch discounts')
    } finally {
      loading.value = false
    }
  }

  const fetchActiveDiscount = async (
    productId: number,
    originalPrice: number,
  ): Promise<AppliedDiscount | null> => {
    try {
      const response = await $apiFetch<ApiResponse<AppliedDiscount | null>>(
        `${apiBase}/api/discounts/active?productId=${productId}&price=${originalPrice}`,
        { credentials: 'include' as const },
      )
      return response.data ?? null
    } catch {
      return null
    }
  }

  const createDiscount = async (
    input: CreateDiscountInput,
  ): Promise<Discount | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Discount>>(
        `${apiBase}/api/discounts`,
        {
          method: 'POST' as const,
          body: input,
          credentials: 'include' as const,
        },
      )
      discounts.value.unshift(response.data)
      toast.success(response.message)
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create discount')
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateDiscount = async (
    id: number,
    input: UpdateDiscountInput,
  ): Promise<Discount | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Discount>>(
        `${apiBase}/api/discounts/${id}`,
        {
          method: 'PUT' as const,
          body: input,
          credentials: 'include' as const,
        },
      )
      const discountIndex = discounts.value.findIndex(
        existingDiscount => existingDiscount.id === id,
      )
      if (discountIndex !== -1) discounts.value[discountIndex] = response.data
      toast.success(response.message)
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update discount')
      throw error
    } finally {
      loading.value = false
    }
  }

  const deleteDiscount = async (id: number): Promise<void> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<null>>(
        `${apiBase}/api/discounts/${id}`,
        {
          method: 'DELETE' as const,
          credentials: 'include' as const,
        },
      )
      discounts.value = discounts.value.filter(discount => discount.id !== id)
      toast.success(response.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete discount')
      throw error
    } finally {
      loading.value = false
    }
  }

  const deactivateDiscount = async (id: number): Promise<void> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<null>>(
        `${apiBase}/api/discounts/${id}/deactivate`,
        {
          method: 'POST' as const,
          credentials: 'include' as const,
        },
      )
      const discountIndex = discounts.value.findIndex(
        existingDiscount => existingDiscount.id === id,
      )
      if (discountIndex !== -1) {
        discounts.value[discountIndex]!.is_active = false
      }
      toast.success(response.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to deactivate discount')
      throw error
    } finally {
      loading.value = false
    }
  }

  const isDiscountExpired = (discount: Discount): boolean => {
    return new Date(discount.ends_at) < new Date()
  }

  const isDiscountScheduled = (discount: Discount): boolean => {
    return new Date(discount.starts_at) > new Date()
  }

  const getDiscountStatus = (discount: Discount): 'active' | 'scheduled' | 'expired' | 'inactive' => {
    if (!discount.is_active) return 'inactive'
    if (isDiscountExpired(discount)) return 'expired'
    if (isDiscountScheduled(discount)) return 'scheduled'
    return 'active'
  }

  return {
    discounts,
    loading,
    fetchDiscounts,
    fetchActiveDiscount,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    deactivateDiscount,
    isDiscountExpired,
    isDiscountScheduled,
    getDiscountStatus,
  }
}