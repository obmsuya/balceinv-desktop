import { toast } from "vue-sonner";

interface SaleItem {
  product_id: number;
  quantity: number;
  is_wholesale?: boolean;
}

interface Sale {
  id: number;
  receipt_number: string;
  user_id: number;
  total_amount: number;
  payment_type: string;
  sale_type: string;
  tax_amount: number;
  created_at: Date;
  change?: number;
  items?: Array<{
    id: number;
    sale_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    is_wholesale: boolean;
    product: {
      id: number;
      name: string;
      price: number;
      wholesale_price?: number;
    };
  }>;
  user?: {
    name: string;
    email: string;
  };
}

interface SalesFilters {
  start_date?: string;
  end_date?: string;
  payment_type?: string;
  sale_type?: string;
}

interface DailySalesSummary {
  sales: Sale[];
  total_revenue: number;
  total_transactions: number;
  total_tax: number;
}

interface MonthlySalesSummary extends DailySalesSummary {
  average_transaction: number;
}

interface UploadResult {
  created: number;
  errors: Array<{ row: number; error: string }>;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface SaleResult {
  id: number
  receipt_number: string
  total: number
  tax_amount: number
  payment_type: string
  amount_paid: number
  change: number
}

export const useSales = () => {
  const { public: { apiBase } } = useRuntimeConfig();
  const { $apiFetch } = useNuxtApp();

  const sales = ref<Sale[]>([]);
  const loading = ref(false);
  const selectedSale = ref<Sale | null>(null);
  const dailySummary = ref<DailySalesSummary | null>(null);
  const monthlySummary = ref<MonthlySalesSummary | null>(null);

  const fetchSales = async (filters?: SalesFilters): Promise<void> => {
    loading.value = true;
    try {
      const query = new URLSearchParams();
      if (filters?.start_date) query.append("startDate", filters.start_date);
      if (filters?.end_date) query.append("endDate", filters.end_date);
      if (filters?.payment_type) query.append("paymentType", filters.payment_type);
      if (filters?.sale_type) query.append("saleType", filters.sale_type);

      const qs = query.toString();
      const url = qs ? `${apiBase}/api/sales?${qs}` : `${apiBase}/api/sales`;

      const res = await $apiFetch<ApiResponse<Sale[]>>(url, {
        credentials: "include" as const,
      });
      sales.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch sales");
    } finally {
      loading.value = false;
    }
  };

  const fetchSale = async (id: number): Promise<Sale | undefined> => {
    loading.value = true;
    try {
      const res = await $apiFetch<ApiResponse<Sale>>(`${apiBase}/api/sales/${id}`, {
        credentials: "include" as const,
      });
      selectedSale.value = res.data;
      return res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch sale details");
    } finally {
      loading.value = false;
    }
  };

  const createSale = async (data: {
    items: Array<{ productId: number; quantity: number; isWholesale?: boolean; unitPrice?: number }>;
    paymentType: "cash" | "card" | "mobile";
    saleType?: "retail" | "wholesale";
    amountPaid?: number;
    useEfd?: boolean;
  }) => {
    loading.value = true;
    try {
      const res = await $apiFetch<ApiResponse<SaleResult>>(`${apiBase}/api/sales`, {
        method: "POST" as const,
        body: data,
        credentials: "include" as const,
      });
      return res.data;
    } catch (err: any) {
      toast.error("Sale failed", {
        description: err?.data?.message || "Please try again",
      });
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchDailySales = async (date?: Date): Promise<void> => {
    loading.value = true;
    try {
      const query = new URLSearchParams();
      if (date) query.append("date", date.toISOString().split("T")[0]);
      const qs = query.toString();
      const url = qs ? `${apiBase}/api/sales/daily?${qs}` : `${apiBase}/api/sales/daily`;

      const res = await $apiFetch<ApiResponse<DailySalesSummary>>(url, {
        credentials: "include" as const,
      });
      dailySummary.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch daily sales");
    } finally {
      loading.value = false;
    }
  };

  const fetchMonthlySales = async (year?: number, month?: number): Promise<void> => {
    loading.value = true;
    try {
      const query = new URLSearchParams();
      if (year) query.append("year", year.toString());
      if (month) query.append("month", month.toString());
      const qs = query.toString();
      const url = qs ? `${apiBase}/api/sales/monthly?${qs}` : `${apiBase}/api/sales/monthly`;

      const res = await $apiFetch<ApiResponse<MonthlySalesSummary>>(url, {
        credentials: "include" as const,
      });
      monthlySummary.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch monthly sales");
    } finally {
      loading.value = false;
    }
  };

  const fetchSalesByDateRange = async (startDate: Date, endDate: Date): Promise<void> => {
    loading.value = true;
    try {
      const query = new URLSearchParams({
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      });

      const res = await $apiFetch<ApiResponse<Sale[]>>(
        `${apiBase}/api/sales/date-range?${query.toString()}`,
        { credentials: "include" as const },
      );
      sales.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch sales for date range");
    } finally {
      loading.value = false;
    }
  };

  const uploadSalesExcel = async (file: File): Promise<UploadResult | undefined> => {
    loading.value = true;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await $apiFetch<ApiResponse<UploadResult>>(`${apiBase}/api/sales/upload`, {
        method: "POST" as const,
        body: formData,
        credentials: "include" as const,
      });

      toast.success(res.message);
      if (res.data.errors.length > 0) {
        toast.warning(`${res.data.errors.length} sale${res.data.errors.length > 1 ? "s" : ""} could not be imported`);
      }
      await fetchSales();
      return res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to upload sales");
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const downloadTemplate = (): void => {
    window.open(`${apiBase}/api/sales/template`, "_blank");
    toast.success("Template downloaded");
  };

  const exportSales = (startDate?: Date, endDate?: Date): void => {
    const query = new URLSearchParams();
      if (startDate) query.append("startDate", startDate.toISOString().split("T")[0]);
      if (endDate) query.append("endDate", endDate.toISOString().split("T")[0]);
  };

  return {
    sales,
    loading,
    selectedSale,
    dailySummary,
    monthlySummary,
    fetchSales,
    fetchSale,
    createSale,
    fetchDailySales,
    fetchMonthlySales,
    fetchSalesByDateRange,
    uploadSalesExcel,
    downloadTemplate,
    exportSales,
  };
};