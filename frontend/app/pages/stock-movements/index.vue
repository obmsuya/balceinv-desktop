<script setup lang="ts">
import { TrendingUp, TrendingDown, Download, Plus, Package, ShoppingCart, AlertTriangle, Settings } from 'lucide-vue-next';
import { createColumns } from '@/components/stock-movements/columns';
import DataTable from '@/components/stock-movements/DataTable.vue';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'vue-sonner';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '~/composables/useAuth';
import { usePermissions } from '~/composables/usePermissions';

const { user } = useAuth();
const { canCreate, canView, fetchUserPermissions } = usePermissions();

const { 
  movements, 
  loading, 
  selectedMovement, 
  summary,
  fetchMovements, 
  fetchMovement,
  createAdjustment,
  fetchSummary,
  exportReport
} = useStockMovements();

const { products, fetchProducts } = useProducts();

const showDetailsDialog = ref(false);
const showAdjustmentDialog = ref(false);

const adjustmentForm = ref({
  productId: '',
  change: '',
  reason: 'adjust' as 'purchase' | 'adjust' | 'damage',
  reference: ''
});

const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('en-TZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

const columns = computed(() =>
  createColumns({
    onView: async (movement) => {
      await fetchMovement(movement.id);
      showDetailsDialog.value = true;
    },
  })
);

onMounted(async () => {
  if (user.value) {
    await fetchUserPermissions(user.value.id)
  }
  await fetchMovements();
  await fetchSummary();
  await fetchProducts();
});

const handleDateFilter = async (startDate: Date | null, endDate: Date | null) => {
  if (startDate && endDate) {
    await fetchMovements({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  } else {
    await fetchMovements();
  }
};

const handleReasonFilter = async (reason: string) => {
  await fetchMovements({ reason });
};

const handleSearch = async (query: string) => {
  await fetchMovements({ search: query });
};

const openAdjustmentDialog = () => {
  adjustmentForm.value = {
    productId: '',
    change: '',
    reason: 'adjust',
    reference: ''
  };
  showAdjustmentDialog.value = true;
};

const handleAdjustment = async () => {
  if (!adjustmentForm.value.productId || !adjustmentForm.value.change) {
    toast.error('Please fill in all required fields');
    return;
  }

  try {
    await createAdjustment({
      productId: Number(adjustmentForm.value.productId),
      change: Number(adjustmentForm.value.change),
      reason: adjustmentForm.value.reason,
      reference: adjustmentForm.value.reference || undefined
    });
    
    showAdjustmentDialog.value = false;
    await fetchSummary();
  } catch (error) {
    console.error('Failed to create adjustment:', error);
  }
};

const handleExport = () => {
  exportReport();
};

const totalMovements = computed(() => summary.value?.total_movements || 0)
const bySale = computed(() => summary.value?.by_sale || 0)
const byPurchase = computed(() => summary.value?.by_purchase || 0)
const byAdjustment = computed(() => summary.value?.by_adjustment || 0)
const byDamage = computed(() => summary.value?.by_damage || 0)
const netChange = computed(() => summary.value?.net_change || 0)
</script>

<template>
  <div class="container mx-auto py-6 px-4 space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Stock Movements</h1>
        <p class="text-muted-foreground mt-1">
          Track all inventory changes and adjustments
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="handleExport">
          <Download class="mr-2 h-4 w-4" />
          Export Report
        </Button>
        <Button v-if="canCreate('stock_movements')" @click="openAdjustmentDialog" :disabled="loading">
          <Plus class="mr-2 h-4 w-4" />
          New Adjustment
        </Button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Movements</CardTitle>
          <Package class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2">
            <Skeleton class="h-8 w-20" />
          </div>
          <div v-else class="text-2xl font-bold">{{ totalMovements }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Sales</CardTitle>
          <ShoppingCart class="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2">
            <Skeleton class="h-8 w-16" />
          </div>
          <div v-else class="text-2xl font-bold text-destructive">{{ bySale }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Purchases</CardTitle>
          <TrendingUp class="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2">
            <Skeleton class="h-8 w-16" />
          </div>
          <div v-else class="text-2xl font-bold text-green-600">{{ byPurchase }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Adjustments</CardTitle>
          <Settings class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2">
            <Skeleton class="h-8 w-16" />
          </div>
          <div v-else class="text-2xl font-bold">{{ byAdjustment }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Damage</CardTitle>
          <AlertTriangle class="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="space-y-2">
            <Skeleton class="h-8 w-16" />
          </div>
          <div v-else class="text-2xl font-bold text-orange-600">{{ byDamage }}</div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Movement History</CardTitle>
        <CardDescription>Complete log of all stock changes</CardDescription>
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
              <Skeleton class="h-12 w-full" />
              <Skeleton class="h-12 w-full" />
              <Skeleton class="h-12 w-full" />
              <Skeleton class="h-12 w-full" />
              <Skeleton class="h-12 w-full" />
            </div>
          </div>
        </div>
        <DataTable 
          v-else 
          :columns="columns" 
          :data="movements"
          @date-filter="handleDateFilter"
          @reason-filter="handleReasonFilter"
          @search="handleSearch"
        />
      </CardContent>
    </Card>

    <Dialog v-model:open="showDetailsDialog">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Movement Details</DialogTitle>
        </DialogHeader>
        <div v-if="selectedMovement" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Date</p>
              <p class="font-medium">{{ formatDate(selectedMovement.created_at) }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">User</p>
              <p class="font-medium">{{ selectedMovement.user?.name || 'System' }}</p>
            </div>
          </div>

          <Separator />

          <div>
            <p class="text-sm text-muted-foreground mb-2">Product</p>
            <div class="p-3 border rounded-lg">
              <p class="font-semibold">{{ selectedMovement.product?.name }}</p>
              <p class="text-sm text-muted-foreground">SKU: {{ selectedMovement.product?.sku }}</p>
            </div>
          </div>

          <Separator />

          <div class="grid grid-cols-3 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Change</p>
              <div :class="[
                'text-xl font-bold',
                selectedMovement.change > 0 ? 'text-green-600' : 'text-red-600'
              ]">
                {{ selectedMovement.change > 0 ? '+' : '' }}{{ selectedMovement.change }}
              </div>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">New Stock</p>
              <div class="text-xl font-bold">
                {{ selectedMovement.new_quantity }} {{ selectedMovement.product?.unit }}
              </div>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Reason</p>
              <Badge class="mt-1">{{ selectedMovement.reason }}</Badge>
            </div>
          </div>

          <div v-if="selectedMovement.reference">
            <p class="text-sm text-muted-foreground">Reference</p>
            <p class="font-mono text-sm">{{ selectedMovement.reference }}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showAdjustmentDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Stock Adjustment</DialogTitle>
          <DialogDescription>
            Manually adjust stock levels for inventory corrections
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="product">Product *</Label>
            <Select v-model="adjustmentForm.productId">
              <SelectTrigger id="product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem 
                  v-for="product in products" 
                  :key="product.id" 
                  :value="product.id.toString()"
                >
                  {{ product.name }} ({{ product.sku }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="change">Quantity Change *</Label>
            <Input
              id="change"
              v-model="adjustmentForm.change"
              type="number"
              placeholder="Use negative for reduction"
            />
            <p class="text-xs text-muted-foreground">
              Positive for increase, negative for decrease
            </p>
          </div>

          <div class="space-y-2">
            <Label for="reason">Reason *</Label>
            <Select v-model="adjustmentForm.reason">
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Purchase/Restock</SelectItem>
                <SelectItem value="adjust">Manual Adjustment</SelectItem>
                <SelectItem value="damage">Damage/Loss</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="reference">Reference (Optional)</Label>
            <Textarea
              id="reference"
              v-model="adjustmentForm.reference"
              placeholder="Notes or reference information"
              rows="3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAdjustmentDialog = false">Cancel</Button>
          <Button @click="handleAdjustment" :disabled="loading">
            Create Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>