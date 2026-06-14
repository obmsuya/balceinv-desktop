atest
<script setup lang="ts">
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  Download,
  FileText,
  Calendar,
  AlertTriangle,
  Users,
  TrendingDown
} from 'lucide-vue-next';
import { Line, Pie, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const {
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
  exportPDF
} = useReports();

const dateRange = ref<{ start: Date | null; end: Date | null }>({
  start: null,
  end: null
});

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(value);
};

const salesTrendData = computed(() => ({
  labels: dailyTrend.value.map(d => new Date(d.date).toLocaleDateString('en-TZ', { month: 'short', day: 'numeric' })),
  datasets: [
    {
      label: 'Revenue (TZS)',
      data: dailyTrend.value.map(d => d.revenue),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true
    },
    {
      label: 'Sales Count',
      data: dailyTrend.value.map(d => d.sales),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      fill: true,
      yAxisID: 'y1'
    }
  ]
}));

const salesTrendOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            if (context.dataset.label === 'Revenue (TZS)') {
              label += formatCurrency(context.parsed.y);
            } else {
              label += context.parsed.y;
            }
          }
          return label;
        }
      }
    }
  },
  scales: {
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      ticks: {
        callback: function(value: any) {
          return formatCurrency(value);
        }
      }
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      grid: {
        drawOnChartArea: false,
      },
    }
  }
};

const paymentData = computed(() => ({
  labels: ['Cash', 'Card', 'Mobile Money'],
  datasets: [{
    data: [
      salesSummary.value?.cashSales || 0,
      salesSummary.value?.cardSales || 0,
      salesSummary.value?.mobileSales || 0
    ],
    backgroundColor: [
      '#10b981',
      '#3b82f6',
      '#f59e0b'
    ],
    borderWidth: 0
  }]
}));

const paymentOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          const label = context.label || '';
          const value = context.parsed || 0;
          return `${label}: ${formatCurrency(value)}`;
        }
      }
    }
  }
};

const topProductsData = computed(() => ({
  labels: topProducts.value.map(p => p.productName),
  datasets: [{
    label: 'Revenue',
    data: topProducts.value.map(p => p.totalRevenue),
    backgroundColor: '#3b82f6',
  }]
}));

const topProductsOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          return `Revenue: ${formatCurrency(context.parsed.x)}`;
        }
      }
    }
  },
  scales: {
    x: {
      ticks: {
        callback: function(value: any) {
          return formatCurrency(value);
        }
      }
    }
  }
};
const { user } = useAuth();
const { fetchUserPermissions } = usePermissions();

onMounted(async () => {
  if (user.value) await fetchUserPermissions(user.value.id);
  await loadAllReports();
});

const loadAllReports = async () => {
  const range = dateRange.value.start && dateRange.value.end
    ? {
        startDate: dateRange.value.start.toISOString().split('T')[0],
        endDate: dateRange.value.end.toISOString().split('T')[0]
      }
    : undefined;

  await Promise.all([
    fetchSalesSummary(range),
    fetchTopProducts(range, 10),
    fetchSalesByUser(range),
    fetchInventoryReport(),
    fetchFinancialReport(range),
    fetchDailyTrend(range)
  ]);
};

const applyDateFilter = async () => {
  await loadAllReports();
};

const clearDateFilter = async () => {
  dateRange.value = { start: null, end: null };
  await loadAllReports();
};

const generateFinancialPDF = () => {
  if (!financialReport.value || !salesSummary.value) return;

  const dateRangeText = dateRange.value.start && dateRange.value.end
    ? `From ${dateRange.value.start.toLocaleDateString()} to ${dateRange.value.end.toLocaleDateString()}`
    : 'All Time';

  const html = `
    <div class="header">
      <div class="company-name">Business Financial Report</div>
      <div class="report-title">Profit & Loss Statement</div>
      <div class="date-range">${dateRangeText}</div>
    </div>

    <div class="section">
      <div class="section-title">Executive Summary</div>
      <div class="metric-card">
        <div class="metric-label">Total Revenue</div>
        <div class="metric-value">${formatCurrency(financialReport.value.totalRevenue)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Net Profit</div>
        <div class="metric-value text-success">${formatCurrency(financialReport.value.netProfit)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Profit Margin</div>
        <div class="metric-value">${financialReport.value.profitMargin.toFixed(2)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Transactions</div>
        <div class="metric-value">${salesSummary.value.totalSales}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Income Statement</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Amount (TZS)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Revenue</strong></td>
            <td class="text-right"><strong>${formatCurrency(financialReport.value.totalRevenue)}</strong></td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">Total Sales</td>
            <td class="text-right">${formatCurrency(financialReport.value.totalRevenue)}</td>
          </tr>
          <tr>
            <td><strong>Cost of Goods Sold</strong></td>
            <td class="text-right text-danger"><strong>(${formatCurrency(financialReport.value.totalCost)})</strong></td>
          </tr>
          <tr style="border-top: 2px solid #cbd5e1;">
            <td><strong>Gross Profit</strong></td>
            <td class="text-right text-success"><strong>${formatCurrency(financialReport.value.grossProfit)}</strong></td>
          </tr>
          <tr>
            <td><strong>Operating Expenses</strong></td>
            <td class="text-right"></td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">Tax</td>
            <td class="text-right text-danger">(${formatCurrency(financialReport.value.totalTax)})</td>
          </tr>
          <tr style="border-top: 2px solid #cbd5e1;">
            <td><strong>Net Profit</strong></td>
            <td class="text-right text-success"><strong>${formatCurrency(financialReport.value.netProfit)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Payment Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Payment Method</th>
            <th class="text-right">Amount</th>
            <th class="text-right">Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cash</td>
            <td class="text-right">${formatCurrency(salesSummary.value.cashSales)}</td>
            <td class="text-right">${((salesSummary.value.cashSales / salesSummary.value.totalRevenue) * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Card</td>
            <td class="text-right">${formatCurrency(salesSummary.value.cardSales)}</td>
            <td class="text-right">${((salesSummary.value.cardSales / salesSummary.value.totalRevenue) * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Mobile Money</td>
            <td class="text-right">${formatCurrency(salesSummary.value.mobileSales)}</td>
            <td class="text-right">${((salesSummary.value.mobileSales / salesSummary.value.totalRevenue) * 100).toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>Generated on ${new Date().toLocaleDateString('en-TZ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      <p>This is a computer-generated report</p>
    </div>
  `;

  const filename = `Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  exportPDF(html, filename);
};

const generateInventoryPDF = () => {
  if (!inventoryReport.value) return;

  const html = `
    <div class="header">
      <div class="company-name">Inventory Report</div>
      <div class="report-title">Stock Status & Valuation</div>
      <div class="date-range">Generated on ${new Date().toLocaleDateString()}</div>
    </div>

    <div class="section">
      <div class="section-title">Inventory Summary</div>
      <div class="metric-card">
        <div class="metric-label">Total Products</div>
        <div class="metric-value">${inventoryReport.value.totalProducts}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Stock Value</div>
        <div class="metric-value">${formatCurrency(inventoryReport.value.totalStockValue)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Low Stock Items</div>
        <div class="metric-value text-danger">${inventoryReport.value.lowStockCount}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Out of Stock</div>
        <div class="metric-value text-danger">${inventoryReport.value.outOfStockCount}</div>
      </div>
    </div>

    ${inventoryReport.value.lowStockItems.length > 0 ? `
    <div class="section">
      <div class="section-title">Low Stock Items</div>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th class="text-right">Current Stock</th>
            <th class="text-right">Min Stock</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryReport.value.lowStockItems.map((item: any) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.sku}</td>
              <td class="text-right text-danger">${item.quantity}</td>
              <td class="text-right">${item.minStock}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${inventoryReport.value.outOfStockItems.length > 0 ? `
    <div class="section">
      <div class="section-title">Out of Stock Items</div>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryReport.value.outOfStockItems.map((item: any) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.sku}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      <p>Generated on ${new Date().toLocaleDateString('en-TZ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  `;

  const filename = `Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  exportPDF(html, filename);
};
</script>

<template>
  <div class="container mx-auto py-6 px-4 space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p class="text-muted-foreground mt-1">
          Comprehensive business insights and reports
        </p>
      </div>
      
      <div class="flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline">
              <Calendar class="mr-2 h-4 w-4" />
              {{ dateRange.start && dateRange.end 
                ? `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}` 
                : 'All Time' }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0" align="end">
            <div class="p-3 space-y-3">
              <div>
                <p class="text-sm font-medium mb-2">Start Date</p>
                <CalendarComponent v-model="dateRange.start as any" />
              </div>
              <div>
                <p class="text-sm font-medium mb-2">End Date</p>
                <CalendarComponent v-model="dateRange.end as any" />
              </div>
              <div class="flex gap-2">
                <Button @click="applyDateFilter" size="sm" class="flex-1">Apply</Button>
                <Button @click="clearDateFilter" variant="outline" size="sm" class="flex-1">Clear</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="outline" @click="exportExcel(dateRange.start && dateRange.end ? { startDate: dateRange.start.toISOString().split('T')[0], endDate: dateRange.end.toISOString().split('T')[0] } : undefined)">
          <Download class="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>
    </div>

    <Tabs default-value="overview" class="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="sales">Sales</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="financial">Financial</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div v-if="loading">
                <Skeleton class="h-8 w-32" />
              </div>
              <div v-else class="text-2xl font-bold">
                {{ formatCurrency(salesSummary?.totalRevenue || 0) }}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">Total Sales</CardTitle>
              <ShoppingCart class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div v-if="loading">
                <Skeleton class="h-8 w-20" />
              </div>
              <div v-else class="text-2xl font-bold">
                {{ salesSummary?.totalSales || 0 }}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">Net Profit</CardTitle>
              <TrendingUp class="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div v-if="loading">
                <Skeleton class="h-8 w-32" />
              </div>
              <div v-else class="text-2xl font-bold text-green-600">
                {{ formatCurrency(financialReport?.netProfit || 0) }}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">Stock Value</CardTitle>
              <Package class="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div v-if="loading">
                <Skeleton class="h-8 w-32" />
              </div>
              <div v-else class="text-2xl font-bold">
                {{ formatCurrency(inventoryReport?.totalStockValue || 0) }}
              </div>
            </CardContent>
          </Card>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
              <CardDescription>Daily sales over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="loading" class="h-[300px] flex items-center justify-center">
                <Skeleton class="h-full w-full" />
              </div>
              <div v-else class="h-[300px]">
                <Line :data="salesTrendData" :options="salesTrendOptions" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Sales by payment type</CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="loading" class="h-[300px] flex items-center justify-center">
                <Skeleton class="h-full w-full" />
              </div>
              <div v-else class="h-[300px]">
                <Pie :data="paymentData" :options="paymentOptions" />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="sales" class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>Best performers by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="loading" class="h-[400px] flex items-center justify-center">
                <Skeleton class="h-full w-full" />
              </div>
              <div v-else class="h-[400px]">
                <Bar :data="topProductsData" :options="topProductsOptions" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales by User</CardTitle>
              <CardDescription>Performance by team member</CardDescription>
            </CardHeader>
            <CardContent>
              <div v-if="loading" class="space-y-2">
                <Skeleton class="h-12 w-full" v-for="i in 5" :key="i" />
              </div>
              <div v-else class="space-y-3">
                <div v-for="user in salesByUser" :key="user.userId" class="flex items-center justify-between p-3 border rounded-lg">
                  <div class="flex items-center gap-3">
                    <Users class="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p class="font-medium">{{ user.userName }}</p>
                      <p class="text-sm text-muted-foreground">{{ user.totalSales }} sales</p>
                    </div>
                  </div>
                  <p class="font-semibold">{{ formatCurrency(user.totalRevenue) }}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="inventory" class="space-y-4">
        <div class="flex justify-end mb-4">
          <Button @click="generateInventoryPDF" variant="outline">
            <FileText class="mr-2 h-4 w-4" />
            Download PDF Report
          </Button>
        </div>

        <Accordion type="single" collapsible class="w-full">
          <AccordionItem value="low-stock">
            <AccordionTrigger>
              <div class="flex items-center gap-2">
                <AlertTriangle class="h-5 w-5 text-orange-600" />
                <span>Low Stock Items ({{ inventoryReport?.lowStockCount || 0 }})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div v-if="inventoryReport?.lowStockItems.length" class="space-y-2">
                <div v-for="item in inventoryReport.lowStockItems" :key="item.id" class="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p class="font-medium">{{ item.name }}</p>
                    <p class="text-sm text-muted-foreground">{{ item.sku }}</p>
                  </div>
                  <div class="text-right">
                    <Badge variant="destructive">{{ item.quantity }} / {{ item.minStock }}</Badge>
                  </div>
                </div>
              </div>
              <p v-else class="text-muted-foreground text-center py-4">No low stock items</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="out-stock">
            <AccordionTrigger>
              <div class="flex items-center gap-2">
                <Package class="h-5 w-5 text-red-600" />
                <span>Out of Stock Items ({{ inventoryReport?.outOfStockCount || 0 }})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div v-if="inventoryReport?.outOfStockItems.length" class="space-y-2">
                <div v-for="item in inventoryReport.outOfStockItems" :key="item.id" class="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p class="font-medium">{{ item.name }}</p>
                    <p class="text-sm text-muted-foreground">{{ item.sku }}</p>
                  </div>
                  <Badge variant="destructive">Out of Stock</Badge>
                </div>
              </div>
              <p v-else class="text-muted-foreground text-center py-4">No out of stock items</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dead-stock">
            <AccordionTrigger>
              <div class="flex items-center gap-2">
                <TrendingDown class="h-5 w-5 text-gray-600" />
                <span>Dead Stock ({{ inventoryReport?.deadStockCount || 0 }})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div v-if="inventoryReport?.deadStockItems.length" class="space-y-2">
                <div v-for="item in inventoryReport.deadStockItems" :key="item.id" class="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p class="font-medium">{{ item.name }}</p>
                    <p class="text-sm text-muted-foreground">{{ item.sku }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm">{{ item.quantity }} units</p>
                    <Badge variant="outline">{{ item.daysSinceLastSale }}+ days</Badge>
                  </div>
                </div>
              </div>
              <p v-else class="text-muted-foreground text-center py-4">No dead stock</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </TabsContent>

      <TabsContent value="financial" class="space-y-4">
        <div class="flex justify-end mb-4">
          <Button @click="generateFinancialPDF" variant="outline">
            <FileText class="mr-2 h-4 w-4" />
            Download P&L Statement
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Summary</CardTitle>
            <CardDescription>Financial performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="loading" class="space-y-4">
              <Skeleton class="h-16 w-full" v-for="i in 6" :key="i" />
            </div>
            <div v-else class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 border rounded-lg">
                  <p class="text-sm text-muted-foreground mb-1">Total Revenue</p>
                  <p class="text-2xl font-bold">{{ formatCurrency(financialReport?.totalRevenue || 0) }}</p>
                </div>
                <div class="p-4 border rounded-lg">
                  <p class="text-sm text-muted-foreground mb-1">Total Cost</p>
                  <p class="text-2xl font-bold text-red-600">{{ formatCurrency(financialReport?.totalCost || 0) }}</p>
                </div>
              </div>

              <Separator />

              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 border rounded-lg">
                  <p class="text-sm text-muted-foreground mb-1">Gross Profit</p>
                  <p class="text-2xl font-bold text-green-600">{{ formatCurrency(financialReport?.grossProfit || 0) }}</p>
                </div>
                <div class="p-4 border rounded-lg">
                  <p class="text-sm text-muted-foreground mb-1">Profit Margin</p>
                  <p class="text-2xl font-bold">{{ financialReport?.profitMargin.toFixed(2) || 0 }}%</p>
                </div>
              </div>

              <Separator />

              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 border rounded-lg">
                  <p class="text-sm text-muted-foreground mb-1">Tax Collected</p>
                  <p class="text-2xl font-bold">{{ formatCurrency(financialReport?.totalTax || 0) }}</p>
                </div>
                <div class="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                  <p class="text-sm text-muted-foreground mb-1">Net Profit</p>
                  <p class="text-2xl font-bold text-green-600">{{ formatCurrency(financialReport?.netProfit || 0) }}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>