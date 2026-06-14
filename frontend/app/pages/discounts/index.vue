<script setup lang="ts">
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  Clock,
  CheckCircle,
  XCircle,
  CalendarClock,
  ToggleLeft,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Discount } from '@/composables/useDiscounts'
import { useDiscounts } from '@/composables/useDiscounts'
import { useProducts } from '@/composables/useProducts'

const {
  discounts,
  loading,
  fetchDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  deactivateDiscount,
  getDiscountStatus,
} = useDiscounts()

const { products, fetchProducts } = useProducts()

// ── Dialog visibility ─────────────────────────────────────────────────────
const showFormDialog = ref(false)
const showDeleteDialog = ref(false)
const showDeactivateDialog = ref(false)

// ── Selected record ───────────────────────────────────────────────────────
const selectedDiscount = ref<Discount | null>(null)
const isEditing = ref(false)

// ── Form state ────────────────────────────────────────────────────────────
const formData = ref({
  name: '',
  product_id: '' as string,
  discount_type: 'percent' as 'percent' | 'fixed',
  value: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
})

const { user } = useAuth();
const { fetchUserPermissions } = usePermissions();

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
if (user.value) {
    await fetchUserPermissions(user.value.id)
    await Promise.all([fetchDiscounts(), fetchProducts()])
  } else {
    await Promise.all([fetchDiscounts(), fetchProducts()])
  }
})

// ── Formatting helpers ────────────────────────────────────────────────────
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(value)

const formatDate = (dateString: string): string =>
  new Intl.DateTimeFormat('en-TZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))

const toDateInputValue = (dateString: string): string => {
  if (!dateString) return ''
  return new Date(dateString).toISOString().slice(0, 16)
}

const toISOString = (localDateTimeString: string): string => {
  if (!localDateTimeString) return ''
  return new Date(localDateTimeString).toISOString()
}

// ── Status badge config ───────────────────────────────────────────────────
type StatusConfig = {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  icon: any
}

const statusConfig: Record<string, StatusConfig> = {
  active:    { label: 'Active',     variant: 'default',     icon: CheckCircle },
  scheduled: { label: 'Scheduled',  variant: 'secondary',   icon: CalendarClock },
  expired:   { label: 'Expired',    variant: 'outline',     icon: Clock },
  inactive:  { label: 'Inactive',   variant: 'destructive', icon: XCircle },
}

const getStatusConfig = (discount: Discount): StatusConfig =>
  statusConfig[getDiscountStatus(discount)] ?? statusConfig.inactive

// ── Discount value display ────────────────────────────────────────────────
const formatDiscountValue = (discount: Discount): string =>
  discount.discount_type === 'percent'
    ? `${discount.value}% off`
    : `${formatCurrency(discount.value)} off`

// ── Stats ─────────────────────────────────────────────────────────────────
const activeCount = computed(
  () => discounts.value.filter(discount => getDiscountStatus(discount) === 'active').length,
)

const scheduledCount = computed(
  () => discounts.value.filter(discount => getDiscountStatus(discount) === 'scheduled').length,
)

// ── Open form dialog ──────────────────────────────────────────────────────
const openCreateDialog = () => {
  isEditing.value = false
  selectedDiscount.value = null

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  formData.value = {
    name: '',
    product_id: 'all',
    discount_type: 'percent',
    value: '',
    starts_at: now.toISOString().slice(0, 16),
    ends_at: tomorrow.toISOString().slice(0, 16),
    is_active: true,
  }

  showFormDialog.value = true
}

const openEditDialog = (discount: Discount) => {
  isEditing.value = true
  selectedDiscount.value = discount

  formData.value = {
    name: discount.name,
    product_id: discount.product_id ? String(discount.product_id) : 'all',
    discount_type: discount.discount_type,
    value: String(discount.value),
    starts_at: toDateInputValue(discount.starts_at),
    ends_at: toDateInputValue(discount.ends_at),
    is_active: discount.is_active,
  }

  showFormDialog.value = true
}

// ── Validation ────────────────────────────────────────────────────────────
const validateForm = (): boolean => {
  if (!formData.value.name.trim()) {
    toast.error('Offer name is required')
    return false
  }
  if (!formData.value.value || Number.parseFloat(formData.value.value) <= 0) {
    toast.error('Discount value must be greater than zero')
    return false
  }
  if (formData.value.discount_type === 'percent' && Number.parseFloat(formData.value.value) > 100) {
    toast.error('Percentage discount cannot exceed 100%')
    return false
  }
  if (!formData.value.starts_at || !formData.value.ends_at) {
    toast.error('Start and end dates are required')
    return false
  }
  if (new Date(formData.value.ends_at) <= new Date(formData.value.starts_at)) {
    toast.error('End date must be after start date')
    return false
  }
  return true
}

// ── Submit ────────────────────────────────────────────────────────────────
const handleSubmit = async () => {
  if (!validateForm()) return

  const productId =
    formData.value.product_id && formData.value.product_id !== 'all'
      ? Number.parseInt(formData.value.product_id)
      : null

  try {
    if (isEditing.value && selectedDiscount.value) {
      await updateDiscount(selectedDiscount.value.id, {
        name: formData.value.name.trim(),
        product_id: productId,
        discount_type: formData.value.discount_type,
        value: Number.parseFloat(formData.value.value),
        starts_at: toISOString(formData.value.starts_at),
        ends_at: toISOString(formData.value.ends_at),
        is_active: formData.value.is_active,
      })
    } else {
      await createDiscount({
        name: formData.value.name.trim(),
        product_id: productId,
        discount_type: formData.value.discount_type,
        value: Number.parseFloat(formData.value.value),
        starts_at: toISOString(formData.value.starts_at),
        ends_at: toISOString(formData.value.ends_at),
      })
    }
    showFormDialog.value = false
  } catch {
    // toast already shown inside composable
  }
}

// ── Delete ────────────────────────────────────────────────────────────────
const confirmDelete = async () => {
  if (!selectedDiscount.value) return
  try {
    await deleteDiscount(selectedDiscount.value.id)
    showDeleteDialog.value = false
    selectedDiscount.value = null
  } catch {
    // toast already shown inside composable
  }
}

// ── Deactivate ────────────────────────────────────────────────────────────
const confirmDeactivate = async () => {
  if (!selectedDiscount.value) return
  try {
    await deactivateDiscount(selectedDiscount.value.id)
    showDeactivateDialog.value = false
    selectedDiscount.value = null
  } catch {
    // toast already shown inside composable
  }
}

// ── Product name lookup ───────────────────────────────────────────────────
const getProductName = (productId: number | null): string => {
  if (!productId) return 'All Products'
  const product = products.value.find(p => p.id === productId)
  return product ? product.name : 'Unknown Product'
}
</script>

<template>
  <div class="container mx-auto py-6 px-4 flex flex-col gap-6">

    <!-- Page header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Offers & Discounts</h1>
        <p class="text-muted-foreground mt-1">
          Set up price offers that apply automatically at checkout
        </p>
      </div>
      <Button @click="openCreateDialog" :disabled="loading">
        <Plus class="mr-2 h-4 w-4" />
        New Offer
      </Button>
    </div>


    <!-- Discounts list -->
    <Card>
      <CardHeader>
        <CardTitle>All Offers</CardTitle>
        <CardDescription>
          Active offers apply automatically when a matching product is added to cart
        </CardDescription>
      </CardHeader>
      <CardContent>

        <!-- Loading state -->
        <div v-if="loading" class="flex flex-col gap-3">
          <Skeleton v-for="i in 4" :key="i" class="h-20 w-full" />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="discounts.length === 0"
          class="py-16 flex flex-col items-center gap-3 text-center"
        >
          <div class="size-14 rounded-full bg-muted flex items-center justify-center">
            <Tag class="size-7 text-muted-foreground" />
          </div>
          <p class="font-medium">No offers yet</p>
          <p class="text-sm text-muted-foreground max-w-xs">
            Create your first offer and it will apply automatically at checkout during the set dates.
          </p>
          <Button variant="outline" @click="openCreateDialog">
            <Plus class="mr-2 h-4 w-4" />
            Create First Offer
          </Button>
        </div>

        <!-- List -->
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="discount in discounts"
            :key="discount.id"
            class="flex items-start justify-between gap-4 rounded-lg border px-4 py-4"
            :class="getDiscountStatus(discount) === 'expired' || getDiscountStatus(discount) === 'inactive' ? 'opacity-60' : ''"
          >
            <!-- Left: info -->
            <div class="flex flex-col gap-2 min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold truncate">{{ discount.name }}</p>
                <Badge :variant="getStatusConfig(discount).variant" class="shrink-0">
                  <component :is="getStatusConfig(discount).icon" class="mr-1 h-3 w-3" />
                  {{ getStatusConfig(discount).label }}
                </Badge>
              </div>

              <div class="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                <!-- Discount value -->
                <span class="font-medium text-foreground">
                  {{ formatDiscountValue(discount) }}
                </span>

                <span>·</span>

                <!-- Applies to -->
                <span>{{ getProductName(discount.product_id) }}</span>

                <span>·</span>

                <!-- Date range -->
                <span class="flex items-center gap-1">
                  <Clock class="h-3 w-3" />
                  {{ formatDate(discount.starts_at) }} — {{ formatDate(discount.ends_at) }}
                </span>
              </div>
            </div>

            <!-- Right: actions -->
            <div class="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                @click="openEditDialog(discount)"
              >
                <Pencil class="h-4 w-4" />
              </Button>

              <Button
                v-if="getDiscountStatus(discount) === 'active' || getDiscountStatus(discount) === 'scheduled'"
                variant="ghost"
                size="icon"
                @click="selectedDiscount = discount; showDeactivateDialog = true"
              >
                <ToggleLeft class="h-4 w-4 text-muted-foreground" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                class="text-destructive hover:text-destructive"
                @click="selectedDiscount = discount; showDeleteDialog = true"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- ── Create / Edit dialog ────────────────────────────────────────── -->
    <Dialog v-model:open="showFormDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Edit Offer' : 'New Offer' }}</DialogTitle>
          <DialogDescription>
            {{ isEditing
              ? 'Update the offer details. Changes apply immediately.'
              : 'Set a discount that applies automatically at checkout during the chosen dates.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">

          <!-- Name -->
          <div class="flex flex-col gap-1.5">
            <Label for="offer-name">Offer Name *</Label>
            <Input
              id="offer-name"
              v-model="formData.name"
              placeholder="e.g. Weekend Sale, Ramadan Offer"
            />
          </div>

          <!-- Applies to -->
          <div class="flex flex-col gap-1.5">
            <Label for="offer-product">Applies To</Label>
            <Select v-model="formData.product_id">
              <SelectTrigger id="offer-product">
                <SelectValue placeholder="Choose a product or all products" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem
                    v-for="product in products.filter(p => p.parent_id == null)"
                    :key="product.id"
                    :value="String(product.id)"
                  >
                    {{ product.name }}
                    <span class="text-muted-foreground ml-1 text-xs">{{ product.sku }}</span>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              "All Products" applies this offer to every item in the cart.
            </p>
          </div>

          <Separator />

          <!-- Discount type and value side by side -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="offer-type">Discount Type *</Label>
              <Select v-model="formData.discount_type">
                <SelectTrigger id="offer-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (TZS)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="offer-value">
                {{ formData.discount_type === 'percent' ? 'Percentage Off *' : 'Amount Off (TZS) *' }}
              </Label>
              <Input
                id="offer-value"
                v-model="formData.value"
                type="number"
                :placeholder="formData.discount_type === 'percent' ? 'e.g. 10' : 'e.g. 5000'"
                min="0"
                :max="formData.discount_type === 'percent' ? '100' : undefined"
              />
            </div>
          </div>

          <!-- Live preview of discount -->
          <div
            v-if="formData.value && Number.parseFloat(formData.value) > 0"
            class="rounded-md bg-muted/50 border px-4 py-3 text-sm"
          >
            <span class="text-muted-foreground">This offer gives customers </span>
            <span class="font-semibold">
              {{ formData.discount_type === 'percent'
                ? `${formData.value}% off`
                : formatCurrency(Number.parseFloat(formData.value)) + ' off' }}
            </span>
            <span class="text-muted-foreground">
              {{ formData.product_id && formData.product_id !== 'all'
                ? ` on ${getProductName(Number.parseInt(formData.product_id))}`
                : ' on all products' }}.
            </span>
          </div>

          <Separator />

          <!-- Date range -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="offer-starts">Start Date & Time *</Label>
              <Input
                id="offer-starts"
                v-model="formData.starts_at"
                type="datetime-local"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="offer-ends">End Date & Time *</Label>
              <Input
                id="offer-ends"
                v-model="formData.ends_at"
                type="datetime-local"
              />
            </div>
          </div>

          <!-- Active toggle — only in edit mode -->
          <div v-if="isEditing" class="flex items-center justify-between rounded-md border px-4 py-3">
            <div>
              <p class="text-sm font-medium">Offer Active</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Turn off to pause this offer without deleting it
              </p>
            </div>
            <Switch v-model:checked="formData.is_active" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showFormDialog = false">Cancel</Button>
          <Button @click="handleSubmit" :disabled="loading">
            {{ isEditing ? 'Save Changes' : 'Create Offer' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Deactivate confirmation ─────────────────────────────────────── -->
    <AlertDialog v-model:open="showDeactivateDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop "{{ selectedDiscount?.name }}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This offer will stop applying at checkout immediately. You can re-enable it by editing the offer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Active</AlertDialogCancel>
          <AlertDialogAction @click="confirmDeactivate">
            Stop Offer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- ── Delete confirmation ─────────────────────────────────────────── -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{{ selectedDiscount?.name }}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This offer will be permanently removed. Existing sales that used this offer are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive hover:bg-destructive/90"
            @click="confirmDelete"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>
</template>