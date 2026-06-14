<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, ShoppingCart, Users, DollarSign } from 'lucide-vue-next'
import { Line, Bar } from 'vue-chartjs'
import { 
  Chart as ChartJS, 
  Title, 
  Tooltip, 
  Legend, 
  LineElement, 
  LinearScale, 
  PointElement, 
  CategoryScale, 
  BarElement 
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, LineElement, LinearScale, PointElement, CategoryScale, BarElement)

const { data, pending, error, refresh } = useDashboard()

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const lineChartData = computed(() => ({
  labels: data.value?.dailySales?.map((d: { date: string }) => formatDate(d.date)) || [],
  datasets: [{
    label: 'Sales',
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    data: data.value?.dailySales?.map((d: { total: number }) => d.total) || [],
    tension: 0.4
  }]
}))

const barChartData = computed(() => ({
  labels: data.value?.topProducts?.map((p: { name: string }) => p.name) || [],
  datasets: [{
    label: 'Units Sold',
    backgroundColor: '#2563eb',
    data: data.value?.topProducts?.map((p: { totalSold: number }) => p.totalSold) || []
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p class="text-muted-foreground mt-1">Overview of your inventory and sales</p>
      </div>
      <button 
        @click="refresh()" 
        :disabled="pending"
        class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {{ pending ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <!-- Error State -->
    <Card v-if="error" class="border-destructive/50 bg-destructive/10">
      <CardContent class="pt-6">
        <p class="text-destructive">Failed to load dashboard data. Please try again.</p>
      </CardContent>
    </Card>

    <!-- Stats Cards -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <!-- Total Users -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Users</CardTitle>
          <Users class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="pending" class="space-y-2">
            <Skeleton class="h-8 w-20" />
            <Skeleton class="h-3 w-24" />
          </div>
          <div v-else>
            <div class="text-2xl font-bold">{{ data?.summary?.userCount || 0 }}</div>
            <p class="text-xs text-muted-foreground mt-1">Registered users</p>
          </div>
        </CardContent>
      </Card>

      <!-- Total Products -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Products</CardTitle>
          <Package class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="pending" class="space-y-2">
            <Skeleton class="h-8 w-20" />
            <Skeleton class="h-3 w-24" />
          </div>
          <div v-else>
            <div class="text-2xl font-bold">{{ data?.summary?.productCount || 0 }}</div>
            <p class="text-xs text-muted-foreground mt-1">In inventory</p>
          </div>
        </CardContent>
      </Card>

      <!-- Total Sales -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Sales</CardTitle>
          <ShoppingCart class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="pending" class="space-y-2">
            <Skeleton class="h-8 w-20" />
            <Skeleton class="h-3 w-24" />
          </div>
          <div v-else>
            <div class="text-2xl font-bold">{{ data?.summary?.saleCount || 0 }}</div>
            <p class="text-xs text-muted-foreground mt-1">Completed orders</p>
          </div>
        </CardContent>
      </Card>

      <!-- Total Revenue -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div v-if="pending" class="space-y-2">
            <Skeleton class="h-8 w-28" />
            <Skeleton class="h-3 w-16" />
          </div>
          <div v-else>
            <div class="text-2xl font-bold">{{ formatCurrency(data?.summary?.totalRevenue || 0) }}</div>
            <p class="text-xs text-muted-foreground mt-1">All time</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Charts Row -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Daily Sales Chart -->
      <Card>
        <CardHeader>
          <CardTitle>Daily Sales</CardTitle>
          <CardDescription>Sales performance over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="pending" class="space-y-3">
            <Skeleton class="h-[250px] w-full" />
          </div>
          <div v-else-if="!data?.dailySales || data.dailySales.length === 0" 
               class="h-[250px] flex items-center justify-center">
            <p class="text-muted-foreground text-sm">No sales data available</p>
          </div>
          <div v-else class="h-[250px]">
            <Line :data="lineChartData" :options="chartOptions" />
          </div>
        </CardContent>
      </Card>

      <!-- Top Products Chart -->
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
          <CardDescription>Best selling products by quantity</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="pending" class="space-y-3">
            <Skeleton class="h-[250px] w-full" />
          </div>
          <div v-else-if="!data?.topProducts || data.topProducts.length === 0" 
               class="h-[250px] flex items-center justify-center">
            <p class="text-muted-foreground text-sm">No products data available</p>
          </div>
          <div v-else class="h-[250px]">
            <Bar :data="barChartData" :options="chartOptions" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Products Table -->
    <Card>
      <CardHeader>
        <CardTitle>Top Products Details</CardTitle>
        <CardDescription>Detailed view of best performing products</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="pending" class="space-y-3">
          <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
        </div>
        <div v-else-if="!data?.topProducts || data.topProducts.length === 0" 
             class="py-12 text-center">
          <p class="text-muted-foreground">No products available</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b">
                <th class="text-left py-3 px-4 font-medium text-sm">Product Name</th>
                <th class="text-left py-3 px-4 font-medium text-sm">SKU</th>
                <th class="text-right py-3 px-4 font-medium text-sm">Units Sold</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in data.topProducts" :key="product.id" 
                  class="border-b last:border-0 hover:bg-muted/50 transition-colors">
                <td class="py-3 px-4">{{ product.name }}</td>
                <td class="py-3 px-4 text-muted-foreground">{{ product.sku }}</td>
                <td class="py-3 px-4 text-right font-semibold">{{ product.totalSold }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>