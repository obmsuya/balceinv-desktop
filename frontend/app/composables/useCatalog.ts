import { toast } from 'vue-sonner'

interface CatalogProduct {
  id: number
  business_type: string
  name: string
  category: string | null
  sub_category: string | null
  unit: string
  sku_prefix: string
  default_price: number
  metadata: Record<string, any> | null
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const useCatalog = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()  


  const catalog = ref<CatalogProduct[]>([])
  const loading = ref(false)

  const fetchCatalog = async (): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<CatalogProduct[]>>(
        `${apiBase}/api/catalog`,
        { credentials: 'include' }
      )
      catalog.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to load product catalog')
    } finally {
      loading.value = false
    }
  }

  const searchCatalog = async (query: string): Promise<CatalogProduct[]> => {
    if (!query.trim()) return catalog.value
    const q = query.toLowerCase()
    return catalog.value.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.sub_category?.toLowerCase().includes(q)
    )
  }

  return {
    catalog,
    loading,
    fetchCatalog,
    searchCatalog,
  }
}