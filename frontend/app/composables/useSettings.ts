import { toast } from 'vue-sonner'

// Company fields live in the `companies` table.
// The backend returns them nested under `settings.company`.
interface Company {
  id: number
  name: string
  business_type: string
  phone: string | null
  address: string | null
  tin: string | null
  logo: string | null
  receipt_header: string | null
  receipt_footer: string | null
  primary_color: string | null
}

// All other fields live in the `settings` table.
// Keys match the Go json tags exactly (snake_case).
interface Settings {
  id: number
  company_id: number
  company: Company

  tax_rate: number
  currency: string
  currency_symbol: string
  date_format: string
  receipt_number_format: string

  efd_enabled: boolean
  efd_endpoint: string | null
  efd_api_key: string | null
  efd_last_test_date: string | null
  efd_test_status: string | null

  low_stock_threshold: number
  email_notifications_enabled: boolean
  notification_email: string | null
  alert_sound_enabled: boolean
  alert_on_low_stock: boolean
  alert_on_out_of_stock: boolean
  alert_on_dead_stock: boolean
  dead_stock_days: number

  print_receipt_automatically: boolean
  show_tax_on_receipt: boolean
  show_barcodes_on_receipt: boolean

  updated_by: number | null
  created_at: string
  updated_at: string
}

// Keys match Go's UpdateSettingsInput json tags exactly (snake_case).
// Business fields go to the `companies` table via the service layer.
// All other fields go to the `settings` table.
interface UpdateSettingsInput {
  // → companies table
  business_name?: string
  business_address?: string
  business_phone?: string
  business_tin?: string
  receipt_header?: string
  receipt_footer?: string
  // system → settings table
  tax_rate?: number
  currency?: string
  currency_symbol?: string
  date_format?: string
  receipt_number_format?: string
  // EFD → settings table
  efd_enabled?: boolean
  efd_endpoint?: string
  efd_api_key?: string
  // notifications → settings table
  low_stock_threshold?: number
  email_notifications_enabled?: boolean
  notification_email?: string
  alert_sound_enabled?: boolean
  alert_on_low_stock?: boolean
  alert_on_out_of_stock?: boolean
  alert_on_dead_stock?: boolean
  dead_stock_days?: number
  // hardware / receipt → settings table
  print_receipt_automatically?: boolean
  show_tax_on_receipt?: boolean
  show_barcodes_on_receipt?: boolean
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const useSettings = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const settings = ref<Settings | null>(null)
  const loading = ref(false)
  const testing = ref(false)

  const fetchSettings = async (): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Settings>>(`${apiBase}/api/settings`, {
        credentials: 'include'
      })
      settings.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch settings')
    } finally {
      loading.value = false
    }
  }

  // The backend accepts a single PUT /api/settings.
  // The service layer internally splits fields between companies and settings tables.
  // We just pass the correct snake_case keys and the backend handles routing.
  const updateSettings = async (data: UpdateSettingsInput): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Settings>>(`${apiBase}/api/settings`, {
        method: 'PUT',
        body: data,
        credentials: 'include'
      })
      settings.value = res.data
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update settings')
      throw error
    } finally {
      loading.value = false
    }
  }

  const testEFDConnection = async (endpoint: string, apiKey: string): Promise<boolean> => {
    testing.value = true
    try {
      const res = await $apiFetch<ApiResponse<{ status: string; message: string }>>(
        `${apiBase}/api/settings/test-efd`,
        { method: 'POST', body: { endpoint, apiKey }, credentials: 'include' }
      )
      if (res.data.status === 'success') {
        toast.success(res.message)
        await fetchSettings()
        return true
      }
      toast.error(res.data.message)
      return false
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to test EFD connection')
      return false
    } finally {
      testing.value = false
    }
  }

  const uploadLogo = async (file: File): Promise<string | null> => {
    loading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await $apiFetch<ApiResponse<{ logoUrl: string }>>(
        `${apiBase}/api/settings/upload-logo`,
        { method: 'POST', body: formData, credentials: 'include' }
      )
      toast.success(res.message)
      await fetchSettings()
      return res.data.logoUrl
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to upload logo')
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    settings,
    loading,
    testing,
    fetchSettings,
    updateSettings,
    testEFDConnection,
    uploadLogo,
  }
}