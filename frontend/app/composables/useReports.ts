// composables/useReports.ts
import { toast } from "vue-sonner";

interface SalesSummary {
  totalSales: number;
  totalRevenue: number;
  totalTax: number;
  averageTransaction: number;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
}

interface TopProduct {
  productId: number;
  productName: string;
  sku: string;
  totalQuantity: number;
  totalRevenue: number;
  salesCount: number;
}

interface SalesByUser {
  userId: number;
  userName: string;
  totalSales: number;
  totalRevenue: number;
}

interface InventoryReport {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  deadStockCount: number;
  lowStockItems: Array<{
    id: number;
    name: string;
    sku: string;
    quantity: number;
    minStock: number;
  }>;
  outOfStockItems: Array<{ id: number; name: string; sku: string }>;
  deadStockItems: Array<{
    id: number;
    name: string;
    sku: string;
    quantity: number;
    daysSinceLastSale: number;
  }>;
}

interface FinancialReport {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  totalTax: number;
  netProfit: number;
}

interface DailyTrend {
  date: string;
  sales: number;
  revenue: number;
}

interface DateRange {
  startDate?: string;
  endDate?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const useReports = () => {
  const {
    public: { apiBase },
  } = useRuntimeConfig();
  const { $apiFetch } = useNuxtApp();

  const loading = ref(false);
  const salesSummary = ref<SalesSummary | null>(null);
  const topProducts = ref<TopProduct[]>([]);
  const salesByUser = ref<SalesByUser[]>([]);
  const inventoryReport = ref<InventoryReport | null>(null);
  const financialReport = ref<FinancialReport | null>(null);
  const dailyTrend = ref<DailyTrend[]>([]);

  const buildQuery = (dateRange?: DateRange) => {
    const query = new URLSearchParams();
    if (dateRange?.startDate) query.append("startDate", dateRange.startDate);
    if (dateRange?.endDate) query.append("endDate", dateRange.endDate);
    return query.toString();
  };

  const fetchSalesSummary = async (dateRange?: DateRange): Promise<void> => {
    loading.value = true;
    try {
      const qs = buildQuery(dateRange);
      const url = qs
        ? `${apiBase}/api/reports/sales-summary?${qs}`
        : `${apiBase}/api/reports/sales-summary`;

      const res = await $apiFetch<ApiResponse<SalesSummary>>(url, {
        credentials: "include",
      });
      salesSummary.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch sales summary");
    } finally {
      loading.value = false;
    }
  };

  const fetchTopProducts = async (
    dateRange?: DateRange,
    limit = 10,
  ): Promise<void> => {
    loading.value = true;
    try {
      const qs = buildQuery(dateRange);
      const query = qs ? `${qs}&limit=${limit}` : `limit=${limit}`;

      const res = await $apiFetch<ApiResponse<TopProduct[]>>(
        `${apiBase}/api/reports/top-products?${query}`,
        { credentials: "include" },
      );
      topProducts.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch top products");
    } finally {
      loading.value = false;
    }
  };

  const fetchSalesByUser = async (dateRange?: DateRange): Promise<void> => {
    loading.value = true;
    try {
      const qs = buildQuery(dateRange);
      const url = qs
        ? `${apiBase}/api/reports/sales-by-user?${qs}`
        : `${apiBase}/api/reports/sales-by-user`;

      const res = await $apiFetch<ApiResponse<SalesByUser[]>>(url, {
        credentials: "include",
      });
      salesByUser.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch sales by user");
    } finally {
      loading.value = false;
    }
  };

  const fetchInventoryReport = async (): Promise<void> => {
    loading.value = true;
    try {
      const res = await $apiFetch<ApiResponse<InventoryReport>>(
        `${apiBase}/api/reports/inventory`,
        { credentials: "include" },
      );
      inventoryReport.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch inventory report");
    } finally {
      loading.value = false;
    }
  };

  const fetchFinancialReport = async (dateRange?: DateRange): Promise<void> => {
    loading.value = true;
    try {
      const qs = buildQuery(dateRange);
      const url = qs
        ? `${apiBase}/api/reports/financial?${qs}`
        : `${apiBase}/api/reports/financial`;

      const res = await $apiFetch<ApiResponse<FinancialReport>>(url, {
        credentials: "include",
      });
      financialReport.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch financial report");
    } finally {
      loading.value = false;
    }
  };

  const fetchDailyTrend = async (dateRange?: DateRange): Promise<void> => {
    loading.value = true;
    try {
      const qs = buildQuery(dateRange);
      const url = qs
        ? `${apiBase}/api/reports/daily-trend?${qs}`
        : `${apiBase}/api/reports/daily-trend`;

      const res = await $apiFetch<ApiResponse<DailyTrend[]>>(url, {
        credentials: "include",
      });
      dailyTrend.value = res.data;
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch daily trend");
    } finally {
      loading.value = false;
    }
  };

  const exportExcel = (dateRange?: DateRange): void => {
    const qs = buildQuery(dateRange);
    const url = qs
      ? `${apiBase}/api/reports/export-excel?${qs}`
      : `${apiBase}/api/reports/export-excel`;

    window.open(url, "_blank");
    toast.success("Report downloaded");
  };

  const exportPDF = async (html: string, filename: string): Promise<void> => {
    try {
      const response = await $apiFetch<Uint8Array>(
        `${apiBase}/api/reports/export-pdf`,
        {
          method: "POST" as const,
          body: { html, filename },
          credentials: "include",
        },
      );

      const arrayBuffer = new ArrayBuffer(response.byteLength);
      new Uint8Array(arrayBuffer).set(response);
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to generate PDF");
    }
  };

  return {
    loading,
    salesSummary,
    topProducts,
    salesByUser,
    inventoryReport,
    financialReport,
    dailyTrend,
    fetchSalesSummary,
    fetchTopProducts,
    fetchSalesByUser,
    fetchInventoryReport,
    fetchFinancialReport,
    fetchDailyTrend,
    exportExcel,
    exportPDF,
  };
};
