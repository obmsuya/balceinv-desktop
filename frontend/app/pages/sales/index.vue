<script setup lang="ts">
import { TrendingUp, DollarSign, ShoppingCart, Receipt, Upload, Download, FileSpreadsheet } from 'lucide-vue-next';
import { columns } from '@/components/sales/columns';
import DataTable from '@/components/sales/DataTable.vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'vue-sonner';
import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';

const { user } = useAuth();
const { canCreate, fetchUserPermissions } = usePermissions();

const {
  sales,
  loading,
  selectedSale,
  monthlySummary,
  fetchSales,
  fetchSale,
  fetchMonthlySales,
  uploadSalesExcel,
  downloadTemplate,
  exportSales
} = useSales();

const showDetailsDialog = ref(false);
const showUploadDialog = ref(false);
const uploadFile = ref<File | null>(null);
const exportDateRange = ref<{ start: Date | null; end: Date | null }>({
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

onMounted(async () => {
  if (user.value) {
    await fetchUserPermissions(user.value.id);
  }
  await fetchSales();
  await fetchMonthlySales();
});

// ✅ FIX: Handle view-sale via direct emit from DataTable — no window listeners
const handleViewSale = async (sale: any) => {
  await fetchSale(sale.id);
  showDetailsDialog.value = true;
};

const handleDateFilter = async (startDate: Date | null, endDate: Date | null) => {
  if (startDate && endDate) {
    await fetchSales({
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    });
  } else {
    await fetchSales();
  }
};

const handlePaymentFilter = async (paymentType: string) => {
  await fetchSales({ payment_type: paymentType });
};

const handleTypeFilter = async (saleType: string) => {
  await fetchSales({ sale_type: saleType });
};

const handleFileUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    uploadFile.value = input.files[0];
  }
};

const handleUpload = async () => {
  if (!uploadFile.value) {
    toast.error('Please select a file');
    return;
  }
  try {
    await uploadSalesExcel(uploadFile.value);
    showUploadDialog.value = false;
    uploadFile.value = null;
  } catch (error) {
    console.error('Upload failed:', error);
  }
};

const handleExport = () => {
  if (exportDateRange.value.start && exportDateRange.value.end) {
    exportSales(exportDateRange.value.start, exportDateRange.value.end);
  } else {
    exportSales();
  }
};

const totalRevenue = computed(() => monthlySummary.value?.total_revenue || 0);
const totalTransactions = computed(() => monthlySummary.value?.total_transactions || 0);
const averageTransaction = computed(() => monthlySummary.value?.average_transaction || 0);
const totalTax = computed(() => monthlySummary.value?.total_tax || 0);
</script>

<template>
  <div class="container mx-auto py-6 px-4 space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Sales</h1>
        <p class="text-muted-foreground mt-1">View and manage sales transactions</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="canCreate('sales')"
          variant="outline"
          @click="showUploadDialog = true"
          :disabled="loading"
        >
          <Upload class="mr-2 h-4 w-4" />
          Import Sales
        </Button>
        <Button variant="outline" @click="downloadTemplate">
          <Download class="mr-2 h-4 w-4" />
          Template
        </Button>
        <Button variant="outline" @click="handleExport">
          <FileSpreadsheet class="mr-2 h-4 w-4" />
          Export Report
        </Button>
        <Button v-if="canCreate('sales')" @click="$router.push('/pos')">
          <ShoppingCart class="mr-2 h-4 w-4" />
          Go to POS
        </Button>
      </div>
    </div>

    <!-- <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2"><Skeleton class="h-8 w-32" /></div>
          <div v-else class="text-2xl font-bold">{{ formatCurrency(totalRevenue) }}</div>
          <p class="text-xs text-muted-foreground mt-1">This month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Transactions</CardTitle>
          <Receipt class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2"><Skeleton class="h-8 w-20" /></div>
          <div v-else class="text-2xl font-bold">{{ totalTransactions }}</div>
          <p class="text-xs text-muted-foreground mt-1">This month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Average Sale</CardTitle>
          <TrendingUp class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2"><Skeleton class="h-8 w-28" /></div>
          <div v-else class="text-2xl font-bold">{{ formatCurrency(averageTransaction) }}</div>
          <p class="text-xs text-muted-foreground mt-1">Per transaction</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Tax</CardTitle>
          <Receipt class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2"><Skeleton class="h-8 w-28" /></div>
          <div v-else class="text-2xl font-bold">{{ formatCurrency(totalTax) }}</div>
          <p class="text-xs text-muted-foreground mt-1">This month</p>
        </CardContent>
      </Card>
    </div> -->

    <Card>
      <CardHeader>
        <CardTitle>All Sales</CardTitle>
        <CardDescription>Complete history of sales transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="space-y-4">
          <div class="flex gap-2">
            <Skeleton class="h-10 flex-1" />
            <Skeleton class="h-10 w-[180px]" />
            <Skeleton class="h-10 w-[180px]" />
          </div>
          <div class="rounded-md border">
            <div class="p-4 space-y-3">
              <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
            </div>
          </div>
        </div>

        <DataTable
          v-else
          :columns="columns"
          :data="sales"
          @view-sale="handleViewSale"
          @date-filter="handleDateFilter"
          @payment-filter="handlePaymentFilter"
          @type-filter="handleTypeFilter"
        />
      </CardContent>
    </Card>

    <Dialog v-model:open="showDetailsDialog">
      <DialogContent class="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sale Details</DialogTitle>
        </DialogHeader>
        <div v-if="selectedSale" class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Receipt Number</p>
              <p class="font-mono font-semibold">{{ selectedSale.receipt_number }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Date</p>
              <p class="font-medium">{{ new Date(selectedSale.created_at).toLocaleString() }}</p>
            </div>
          </div>

          <Separator />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Payment Method</p>
              <Badge class="mt-1">{{ selectedSale.payment_type }}</Badge>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Sale Type</p>
              <Badge class="mt-1" :variant="selectedSale.sale_type === 'wholesale' ? 'default' : 'secondary'">
                {{ selectedSale.sale_type }}
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <p class="text-sm font-medium mb-3">Items Sold</p>
            <div class="space-y-2">
              <div
                v-for="item in selectedSale.items"
                :key="item.id"
                class="flex justify-between items-center p-3 border rounded-lg"
              >
                <div class="flex-1">
                  <p class="font-medium">{{ item.product?.name }}</p>
                  <p class="text-sm text-muted-foreground">
                    {{ item.quantity }} × {{ formatCurrency(item.unit_price) }}
                    <Badge v-if="item.is_wholesale" variant="outline" class="ml-2">Wholesale</Badge>
                  </p>
                </div>
                <p class="font-semibold">{{ formatCurrency(item.total_price) }}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Total</span>
              <span class="font-semibold">{{ formatCurrency(selectedSale.total_amount) }}</span>
            </div>
            <p class="text-xs text-muted-foreground">* Price includes 18% VAT</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showUploadDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Sales from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file with your sales data. Make sure to use the provided template.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="file">Select Excel File</Label>
            <Input id="file" type="file" accept=".xlsx,.xls" @change="handleFileUpload" />
          </div>
          <div class="text-sm text-muted-foreground">
            <p>• Each receipt can have multiple items</p>
            <p>• Use the same receipt number for items in the same transaction</p>
            <p>• Date format: YYYY-MM-DD</p>
            <p>• Payment type: cash, card, or mobile</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showUploadDialog = false">Cancel</Button>
          <Button @click="handleUpload" :disabled="!uploadFile || loading">
            <Upload class="mr-2 h-4 w-4" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>