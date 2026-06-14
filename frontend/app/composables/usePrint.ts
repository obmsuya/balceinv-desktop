import { toast } from 'vue-sonner'

interface PrinterStatus {
  enabled: boolean
  port: string
  paper_width: number
  open_drawer: boolean
  auto_print: boolean
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const usePrint = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const printerEnabled = ref(false)
  const autoPrint = ref(false)
  const statusLoaded = ref(false)

  const fetchPrinterStatus = async (): Promise<void> => {
    try {
      const response = await $apiFetch<ApiResponse<PrinterStatus>>(
        `${apiBase}/api/print/status`,
        { credentials: 'include' as const },
      )
      printerEnabled.value = response.data.enabled
      autoPrint.value = response.data.auto_print
      statusLoaded.value = true
    } catch {
      printerEnabled.value = false
      autoPrint.value = false
      statusLoaded.value = true
    }
  }

  const printReceipt = async (saleId: number, openDrawer = false): Promise<boolean> => {
    try {
      await $apiFetch<ApiResponse<null>>(
        `${apiBase}/api/print/receipt`,
        {
          method: 'POST' as const,
          body: { sale_id: saleId, open_drawer: openDrawer },
          credentials: 'include' as const,
        },
      )
      toast.success('Receipt printed')
      return true
    } catch (error: any) {
      toast.error(error?.data?.message || 'Could not reach the printer')
      return false
    }
  }

  return {
    printerEnabled,
    autoPrint,
    statusLoaded,
    fetchPrinterStatus,
    printReceipt,
  }
}