import { toast } from 'vue-sonner'

export interface ProductAddon {
  id: number
  product_id: number
  name: string
  price: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface CreateAddonInput {
  name: string
  price: number
}

interface UpdateAddonInput {
  name: string
  price: number
  is_active: boolean
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const useAddons = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const addons = ref<ProductAddon[]>([])
  const loading = ref(false)

  const fetchAddons = async (productId: number): Promise<void> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<ProductAddon[]>>(
        `${apiBase}/api/products/${productId}/addons`,
        { credentials: 'include' as const },
      )
      addons.value = response.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch addons')
    } finally {
      loading.value = false
    }
  }

  const createAddon = async (
    productId: number,
    input: CreateAddonInput,
  ): Promise<ProductAddon | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<ProductAddon>>(
        `${apiBase}/api/products/${productId}/addons`,
        {
          method: 'POST' as const,
          body: input,
          credentials: 'include' as const,
        },
      )
      addons.value.push(response.data)
      toast.success(response.message)
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create addon')
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateAddon = async (
    id: number,
    input: UpdateAddonInput,
  ): Promise<ProductAddon | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<ProductAddon>>(
        `${apiBase}/api/addons/${id}`,
        {
          method: 'PUT' as const,
          body: input,
          credentials: 'include' as const,
        },
      )
      const addonIndex = addons.value.findIndex(existingAddon => existingAddon.id === id)
      if (addonIndex !== -1) addons.value[addonIndex] = response.data
      toast.success(response.message)
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update addon')
      throw error
    } finally {
      loading.value = false
    }
  }

  const deleteAddon = async (id: number): Promise<void> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<null>>(
        `${apiBase}/api/addons/${id}`,
        {
          method: 'DELETE' as const,
          credentials: 'include' as const,
        },
      )
      addons.value = addons.value.filter(addon => addon.id !== id)
      toast.success(response.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete addon')
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    addons,
    loading,
    fetchAddons,
    createAddon,
    updateAddon,
    deleteAddon,
  }
}