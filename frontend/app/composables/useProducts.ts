import { toast } from 'vue-sonner'

export interface Product {
  id: number
  name: string
  sku: string
  barcode?: string | null
  parent_id?: number | null
  variant_label?: string | null
  price: number
  cost_price: number
  quantity: number
  min_stock: number
  wholesale_price?: number | null
  wholesale_min?: number | null
  category?: string | null
  unit: string
  pieces_per_unit: number
  image?: string | null
  metadata?: Record<string, any> | null
  variants?: Product[]
  addons?: ProductAddon[]
  created_at?: string
  updated_at?: string
}

export interface ProductAddon {
  id: number
  product_id: number
  name: string
  price: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface ProductFilters {
  search?: string
  category?: string
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

interface UploadResult {
  created: number
  errors: Array<{ sku: string; error: string }>
}

export const useProducts = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const products = ref<Product[]>([])
  const lowStockProducts = ref<Product[]>([])
  const loading = ref(false)
  const selectedProduct = ref<Product | null>(null)

  const fetchProducts = async (filters?: ProductFilters): Promise<void> => {
    loading.value = true
    try {
      const query = new URLSearchParams()
      if (filters?.search) query.append('search', filters.search)
      if (filters?.category) query.append('category', filters.category)
      const queryString = query.toString()
      const url = queryString
        ? `${apiBase}/api/products?${queryString}`
        : `${apiBase}/api/products`

      const response = await $apiFetch<ApiResponse<Product[]>>(url, {
        credentials: 'include' as const,
      })
      products.value = response.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch products')
    } finally {
      loading.value = false
    }
  }

  const fetchProduct = async (id: number): Promise<Product | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Product>>(
        `${apiBase}/api/products/${id}`,
        { credentials: 'include' as const },
      )
      selectedProduct.value = response.data
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Could not load product details')
    } finally {
      loading.value = false
    }
  }

  const fetchVariants = async (parentId: number): Promise<Product[]> => {
    try {
      const response = await $apiFetch<ApiResponse<Product[]>>(
        `${apiBase}/api/products/${parentId}/variants`,
        { credentials: 'include' as const },
      )
      return response.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch variants')
      return []
    }
  }

  const createProduct = async (product: Partial<Product>): Promise<Product | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Product>>(
        `${apiBase}/api/products`,
        {
          method: 'POST' as const,
          body: product,
          credentials: 'include' as const,
        },
      )
      products.value.unshift(response.data)
      toast.success(response.message)
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create product')
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateProduct = async (
    id: number,
    product: Partial<Product>,
  ): Promise<Product | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Product>>(
        `${apiBase}/api/products/${id}`,
        {
          method: 'PUT' as const,
          body: product,
          credentials: 'include' as const,
        },
      )
      const productIndex = products.value.findIndex(existingProduct => existingProduct.id === id)
      if (productIndex !== -1) products.value[productIndex] = response.data
      toast.success(response.message)
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update product')
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateProductImage = async (id: number, imageDataURI: string): Promise<Product | undefined> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Product>>(
        `${apiBase}/api/products/${id}/image`,
        {
          method: 'POST' as const,
          body: { image: imageDataURI },
          credentials: 'include' as const,
        },
      )
      const productIndex = products.value.findIndex(existingProduct => existingProduct.id === id)
      if (productIndex !== -1) products.value[productIndex] = response.data
      toast.success('Product image updated')
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update product image')
      throw error
    } finally {
      loading.value = false
    }
  }

  const deleteProduct = async (id: number): Promise<void> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<null>>(
        `${apiBase}/api/products/${id}`,
        {
          method: 'DELETE' as const,
          credentials: 'include' as const,
        },
      )
      products.value = products.value.filter(product => product.id !== id)
      toast.success(response.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete product')
      throw error
    } finally {
      loading.value = false
    }
  }

  const uploadExcel = async (file: File): Promise<UploadResult | undefined> => {
    loading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await $apiFetch<ApiResponse<UploadResult>>(
        `${apiBase}/api/products/upload`,
        {
          method: 'POST' as const,
          body: formData,
          credentials: 'include' as const,
        },
      )
      toast.success(response.message)
      if (response.data.errors.length > 0) {
        toast.warning(
          `${response.data.errors.length} product${response.data.errors.length > 1 ? 's' : ''} could not be imported`,
        )
      }
      await fetchProducts()
      return response.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to upload products')
      throw error
    } finally {
      loading.value = false
    }
  }

  const downloadTemplate = (): void => {
    window.open(`${apiBase}/api/products/template`, '_blank')
    toast.success('Template downloaded')
  }

  const fetchLowStock = async (): Promise<void> => {
    loading.value = true
    try {
      const response = await $apiFetch<ApiResponse<Product[]>>(
        `${apiBase}/api/products/low-stock`,
        { credentials: 'include' as const },
      )
      lowStockProducts.value = response.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch low stock products')
    } finally {
      loading.value = false
    }
  }

  return {
    products,
    lowStockProducts,
    loading,
    selectedProduct,
    fetchProducts,
    fetchProduct,
    fetchVariants,
    createProduct,
    updateProduct,
    updateProductImage,
    deleteProduct,
    uploadExcel,
    downloadTemplate,
    fetchLowStock,
  }
}