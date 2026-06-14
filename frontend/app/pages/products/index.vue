<script setup lang="ts">
import {
  Plus,
  Upload,
  Download,
  Package,
  DollarSign,
  AlertTriangle,
  X,
  ImageOff,
  GitBranch,
  Puzzle,
  Trash2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { createColumns } from '@/components/products/columns'
import DataTable from '@/components/products/DataTable.vue'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Product, ProductAddon } from '@/composables/useProducts'
import { useAuth } from '@/composables/useAuth'
import { usePermissions } from '@/composables/usePermissions'
import { useCatalog } from '@/composables/useCatalog'
import { useAddons } from '@/composables/useAddons'

const { user } = useAuth()
const { canCreate, canEdit, canDelete, fetchUserPermissions } = usePermissions()

const {
  products,
  loading,
  selectedProduct,
  fetchProducts,
  createProduct,
  updateProduct,
  updateProductImage,
  deleteProduct,
  uploadExcel,
  downloadTemplate,
} = useProducts()

const { addons, fetchAddons, createAddon, deleteAddon } = useAddons()
const { catalog, loading: catalogLoading, fetchCatalog, searchCatalog } = useCatalog()

// ── Dialog visibility ─────────────────────────────────────────────────────
const showProductDialog = ref(false)
const showDeleteDialog = ref(false)
const showDetailsDialog = ref(false)
const showUploadDialog = ref(false)

// ── Form mode ─────────────────────────────────────────────────────────────
const isEditing = ref(false)
const isAddingVariant = ref(false)
const parentProductForVariant = ref<Product | null>(null)
const activeDialogTab = ref('details')

// ── Upload ────────────────────────────────────────────────────────────────
const uploadFile = ref<File | null>(null)

// ── Image handling ────────────────────────────────────────────────────────
const imagePreview = ref<string | null>(null)
const imageFile = ref<File | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)

// ── Catalog panel ─────────────────────────────────────────────────────────
const showCatalogPanel = ref(false)
const catalogSearch = ref('')
const filteredCatalog = ref<typeof catalog.value>([])

// ── Addon form ────────────────────────────────────────────────────────────
const newAddonName = ref('')
const newAddonPrice = ref('')
const addonLoading = ref(false)

// ── Product form ──────────────────────────────────────────────────────────
const formData = ref({
  name: '',
  sku: '',
  barcode: '',
  price: '',
  cost_price: '',
  quantity: '0',
  min_stock: '5',
  wholesale_price: '',
  wholesale_min: '10',
  category: '',
  unit: 'pcs',
  pieces_per_unit: '1',
  variant_label: '',
})

const metadataFields = ref<Array<{ key: string; value: string }>>([])

// ── Currency helpers ──────────────────────────────────────────────────────
const formatCurrency = (value: string | number): string => {
  const number = typeof value === 'number' ? value : Number.parseFloat(value.replace(/[^0-9.]/g, ''))
  if (Number.isNaN(number)) return ''
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(number)
}

const parseCurrency = (value: string): number =>
  Number.parseFloat(value.replace(/[^0-9.]/g, '')) || 0

const handlePriceInput = (field: 'price' | 'cost_price' | 'wholesale_price', event: Event) => {
  const raw = (event.target as HTMLInputElement).value
  formData.value[field] = raw
  nextTick(() => {
    if (raw) formData.value[field] = formatCurrency(raw)
  })
}

// ── Metadata helpers ──────────────────────────────────────────────────────
const addMetadataField = () => metadataFields.value.push({ key: '', value: '' })
const removeMetadataField = (index: number) => metadataFields.value.splice(index, 1)

const buildMetadata = (): Record<string, string> | null => {
  const entries = metadataFields.value.filter(field => field.key.trim() !== '')
  return entries.length === 0
    ? null
    : Object.fromEntries(entries.map(field => [field.key.trim(), field.value]))
}

// ── Image helpers ─────────────────────────────────────────────────────────
const onImageFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Image must be under 2 MB')
    return
  }
  imageFile.value = file
  const reader = new FileReader()
  reader.onload = readerEvent => {
    imagePreview.value = readerEvent.target?.result as string
  }
  reader.readAsDataURL(file)
}

const removeImage = () => {
  imagePreview.value = null
  imageFile.value = null
  if (imageInputRef.value) imageInputRef.value.value = ''
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  if (user.value) await fetchUserPermissions(user.value.id)
  await fetchProducts()
})

// ── Catalog ───────────────────────────────────────────────────────────────
const toggleCatalogPanel = async () => {
  showCatalogPanel.value = !showCatalogPanel.value
  if (showCatalogPanel.value && catalog.value.length === 0) {
    await fetchCatalog()
    filteredCatalog.value = catalog.value
  }
}

watch(catalogSearch, async value => {
  filteredCatalog.value = await searchCatalog(value)
})

const prefillFromCatalog = (item: typeof catalog.value[number]) => {
  formData.value.name = item.name
  formData.value.category = item.category ?? ''
  formData.value.unit = item.unit
  formData.value.sku = item.sku_prefix ? `${item.sku_prefix}-` : ''
  formData.value.price = item.default_price ? formatCurrency(item.default_price) : ''
  metadataFields.value = item.metadata
    ? Object.entries(item.metadata).map(([key, value]) => ({ key, value: String(value) }))
    : []
  showCatalogPanel.value = false
  catalogSearch.value = ''
}

// ── Columns ───────────────────────────────────────────────────────────────
const columns = computed(() =>
  createColumns({
    canEdit: canEdit('products'),
    canDelete: canDelete('products'),
    onView: product => {
      selectedProduct.value = product
      showDetailsDialog.value = true
    },
    onEdit: async product => {
      isEditing.value = true
      isAddingVariant.value = false
      parentProductForVariant.value = null
      activeDialogTab.value = 'details'
      imagePreview.value = product.image ?? null
      imageFile.value = null

      formData.value = {
        name: product.name,
        sku: product.sku,
        barcode: product.barcode ?? '',
        price: formatCurrency(product.price),
        cost_price: formatCurrency(product.cost_price),
        quantity: product.quantity.toString(),
        min_stock: product.min_stock.toString(),
        wholesale_price: product.wholesale_price ? formatCurrency(product.wholesale_price) : '',
        wholesale_min: product.wholesale_min?.toString() ?? '10',
        category: product.category ?? '',
        unit: product.unit,
        pieces_per_unit: product.pieces_per_unit.toString(),
        variant_label: product.variant_label ?? '',
      }

      metadataFields.value = product.metadata
        ? Object.entries(product.metadata).map(([key, value]) => ({ key, value: String(value) }))
        : []

      selectedProduct.value = product
      showCatalogPanel.value = false
      showProductDialog.value = true

      await fetchAddons(product.id)
    },
    onDelete: product => {
      selectedProduct.value = product
      showDeleteDialog.value = true
    },
    onAddVariant: product => {
      isEditing.value = false
      isAddingVariant.value = true
      parentProductForVariant.value = product
      activeDialogTab.value = 'details'
      imagePreview.value = null
      imageFile.value = null

      formData.value = {
        name: product.name,
        sku: '',
        barcode: '',
        price: formatCurrency(product.price),
        cost_price: formatCurrency(product.cost_price),
        quantity: '0',
        min_stock: product.min_stock.toString(),
        wholesale_price: product.wholesale_price ? formatCurrency(product.wholesale_price) : '',
        wholesale_min: product.wholesale_min?.toString() ?? '10',
        category: product.category ?? '',
        unit: product.unit,
        pieces_per_unit: product.pieces_per_unit.toString(),
        variant_label: '',
      }

      metadataFields.value = []
      showProductDialog.value = true
    },
  }),
)

// ── Open create dialog ────────────────────────────────────────────────────
const openCreateDialog = () => {
  isEditing.value = false
  isAddingVariant.value = false
  parentProductForVariant.value = null
  selectedProduct.value = null
  activeDialogTab.value = 'details'
  imagePreview.value = null
  imageFile.value = null

  formData.value = {
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost_price: '',
    quantity: '0',
    min_stock: '5',
    wholesale_price: '',
    wholesale_min: '10',
    category: '',
    unit: 'pcs',
    pieces_per_unit: '1',
    variant_label: '',
  }

  metadataFields.value = []
  showCatalogPanel.value = false
  catalogSearch.value = ''
  showProductDialog.value = true
}

// ── Dialog title/description ──────────────────────────────────────────────
const dialogTitle = computed(() => {
  if (isAddingVariant.value) return `Add Variant — ${parentProductForVariant.value?.name}`
  if (isEditing.value) return 'Edit Product'
  return 'Add New Product'
})

const dialogDescription = computed(() => {
  if (isAddingVariant.value)
    return 'A variant shares the parent name but has its own SKU, price, and stock.'
  if (isEditing.value) return 'Update product information, image, and add-ons.'
  return 'Fill in the details to add a product to your inventory.'
})

// ── Submit ────────────────────────────────────────────────────────────────
const handleSubmit = async () => {
  if (!formData.value.name || !formData.value.sku || !formData.value.price || !formData.value.cost_price) {
    toast.error('Name, SKU, selling price and cost price are required')
    return
  }

  if (isAddingVariant.value && !formData.value.variant_label) {
    toast.error('Variant label is required — e.g. "Blue / Large"')
    return
  }

  const payload: Partial<Product> = {
    name: formData.value.name,
    sku: formData.value.sku,
    barcode: formData.value.barcode || null,
    price: parseCurrency(formData.value.price),
    cost_price: parseCurrency(formData.value.cost_price),
    quantity: Number.parseInt(formData.value.quantity) || 0,
    min_stock: Number.parseInt(formData.value.min_stock) || 5,
    wholesale_price: formData.value.wholesale_price
      ? parseCurrency(formData.value.wholesale_price)
      : null,
    wholesale_min: Number.parseInt(formData.value.wholesale_min) || 10,
    category: formData.value.category || null,
    unit: formData.value.unit,
    pieces_per_unit: Number.parseInt(formData.value.pieces_per_unit) || 1,
    metadata: buildMetadata(),
    variant_label: formData.value.variant_label || '',
    parent_id:
      isAddingVariant.value && parentProductForVariant.value
        ? parentProductForVariant.value.id
        : null,
    image: imagePreview.value ?? null,
  }

  try {
    if (isEditing.value && selectedProduct.value) {
      await updateProduct(selectedProduct.value.id, payload)
      if (imageFile.value && imagePreview.value) {
        await updateProductImage(selectedProduct.value.id, imagePreview.value)
      }
    } else {
      await createProduct(payload)
    }
    showProductDialog.value = false
  } catch {
    // toast already shown inside composable
  }
}

// ── Delete ────────────────────────────────────────────────────────────────
const confirmDelete = async () => {
  if (!selectedProduct.value) return
  try {
    await deleteProduct(selectedProduct.value.id)
    showDeleteDialog.value = false
    selectedProduct.value = null
  } catch {
    // toast already shown inside composable
  }
}

// ── File upload ───────────────────────────────────────────────────────────
const handleFileUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) uploadFile.value = input.files[0]
}

const handleUpload = async () => {
  if (!uploadFile.value) {
    toast.error('Please select a file')
    return
  }
  try {
    await uploadExcel(uploadFile.value)
    showUploadDialog.value = false
    uploadFile.value = null
  } catch {
    // toast already shown inside composable
  }
}

// ── Addon actions ─────────────────────────────────────────────────────────
const handleCreateAddon = async () => {
  if (!newAddonName.value.trim()) {
    toast.error('Add-on name is required')
    return
  }
  if (!selectedProduct.value) return

  addonLoading.value = true
  try {
    await createAddon(selectedProduct.value.id, {
      name: newAddonName.value.trim(),
      price: parseCurrency(newAddonPrice.value),
    })
    newAddonName.value = ''
    newAddonPrice.value = ''
  } finally {
    addonLoading.value = false
  }
}

const handleDeleteAddon = async (addon: ProductAddon) => {
  addonLoading.value = true
  try {
    await deleteAddon(addon.id)
  } finally {
    addonLoading.value = false
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────
const totalStockValue = computed(() =>
  products.value.reduce((sum, product) => sum + product.price * product.quantity, 0),
)

const lowStockCount = computed(() =>
  products.value.filter(product => product.quantity <= product.min_stock).length,
)
</script>

<template>
  <div class="container mx-auto py-6 px-4 flex flex-col gap-6">

    <!-- Page header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Products</h1>
        <p class="text-muted-foreground mt-1">Manage your inventory, variants and add-ons</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button v-if="canCreate('products')" variant="outline" @click="showUploadDialog = true" :disabled="loading">
          <Upload class="mr-2 h-4 w-4" />
          Import Excel
        </Button>
        <Button variant="outline" @click="downloadTemplate">
          <Download class="mr-2 h-4 w-4" />
          Template
        </Button>
        <Button v-if="canCreate('products')" @click="openCreateDialog" :disabled="loading">
          <Plus class="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>
    </div>

    <!-- Stats row -->
    <div class="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Total Products</CardTitle>
          <Package class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton v-if="loading" class="h-8 w-20" />
          <div v-else class="text-2xl font-bold">{{ products.length }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Stock Value</CardTitle>
          <DollarSign class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton v-if="loading" class="h-8 w-32" />
          <div v-else class="text-2xl font-bold">{{ formatCurrency(totalStockValue) }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Low Stock</CardTitle>
          <AlertTriangle class="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <Skeleton v-if="loading" class="h-8 w-16" />
          <div v-else class="text-2xl font-bold text-destructive">{{ lowStockCount }}</div>
        </CardContent>
      </Card>
    </div>

    <!-- Table -->
    <Card>
      <CardHeader>
        <CardTitle>All Products</CardTitle>
        <CardDescription>Your full inventory including variants</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="flex flex-col gap-3">
          <Skeleton class="h-10 w-full" />
          <Skeleton v-for="i in 7" :key="i" class="h-14 w-full" />
        </div>
        <DataTable v-else :columns="columns" :data="products" />
      </CardContent>
    </Card>

    <!-- ── View Details dialog ─────────────────────────────────────────── -->
    <Dialog v-model:open="showDetailsDialog">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Product Details</DialogTitle>
        </DialogHeader>
        <div v-if="selectedProduct" class="flex flex-col gap-5 py-2">

          <div class="flex items-start gap-4">
            <div class="size-20 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              <img
                v-if="selectedProduct.image"
                :src="selectedProduct.image"
                :alt="selectedProduct.name"
                class="size-full object-cover"
              />
              <ImageOff v-else class="size-8 text-muted-foreground/30" />
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <h2 class="text-lg font-semibold truncate">{{ selectedProduct.name }}</h2>
              <p class="text-sm font-mono text-muted-foreground">{{ selectedProduct.sku }}</p>
              <div class="flex items-center gap-2 flex-wrap mt-1">
                <Badge v-if="selectedProduct.category" variant="outline">
                  {{ selectedProduct.category }}
                </Badge>
                <Badge v-if="selectedProduct.variant_label" variant="secondary">
                  <GitBranch class="mr-1 h-3 w-3" />
                  {{ selectedProduct.variant_label }}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-muted-foreground">Selling Price</p>
              <p class="font-semibold">{{ formatCurrency(selectedProduct.price) }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Cost Price</p>
              <p class="font-semibold">{{ formatCurrency(selectedProduct.cost_price) }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Current Stock</p>
              <Badge
                :variant="
                  selectedProduct.quantity === 0
                    ? 'destructive'
                    : selectedProduct.quantity <= selectedProduct.min_stock
                    ? 'outline'
                    : 'secondary'
                "
              >
                {{ selectedProduct.quantity }} {{ selectedProduct.unit }}
              </Badge>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Alert Below</p>
              <p class="font-medium">{{ selectedProduct.min_stock }} {{ selectedProduct.unit }}</p>
            </div>
          </div>

          <template
            v-if="selectedProduct.metadata && Object.keys(selectedProduct.metadata).length > 0"
          >
            <Separator />
            <div class="flex flex-col gap-2">
              <p class="text-sm font-medium">Additional Details</p>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="(value, key) in selectedProduct.metadata"
                  :key="key"
                  class="rounded-md border px-3 py-2 bg-muted/30"
                >
                  <p class="text-xs text-muted-foreground capitalize">{{ key }}</p>
                  <p class="text-sm font-medium">{{ value }}</p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ── Create / Edit / Add Variant dialog ─────────────────────────── -->
    <Dialog v-model:open="showProductDialog">
      <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ dialogTitle }}</DialogTitle>
          <DialogDescription>{{ dialogDescription }}</DialogDescription>
        </DialogHeader>

        <Tabs v-model="activeDialogTab" class="mt-2">
          <TabsList class="w-full">
            <TabsTrigger value="details" class="flex-1">Details</TabsTrigger>
            <TabsTrigger value="addons" class="flex-1" :disabled="!isEditing">
              <Puzzle class="mr-2 h-4 w-4" />
              Add-ons
              <span
                v-if="addons.length > 0"
                class="ml-2 rounded-full bg-primary/10 px-1.5 text-xs tabular-nums"
              >
                {{ addons.length }}
              </span>
            </TabsTrigger>
          </TabsList>

          <!-- ── Details tab ──────────────────────────────────────────── -->
          <TabsContent value="details" class="flex flex-col gap-4 mt-4">

            <!-- Catalog picker — new products only -->
            <template v-if="!isEditing && !isAddingVariant">
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted-foreground">Already in your catalog?</p>
                <Button variant="outline" size="sm" type="button" @click="toggleCatalogPanel">
                  {{ showCatalogPanel ? 'Hide Catalog' : 'Pick from Catalog' }}
                </Button>
              </div>

              <div
                v-if="showCatalogPanel"
                class="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2"
              >
                <Input v-model="catalogSearch" placeholder="Search catalog..." />
                <div class="max-h-44 overflow-y-auto flex flex-col gap-1">
                  <div v-if="catalogLoading" class="flex flex-col gap-1">
                    <Skeleton v-for="i in 3" :key="i" class="h-12 w-full" />
                  </div>
                  <p
                    v-else-if="filteredCatalog.length === 0"
                    class="text-center text-sm text-muted-foreground py-4"
                  >
                    No items found
                  </p>
                  <button
                    v-else
                    v-for="item in filteredCatalog"
                    :key="item.id"
                    type="button"
                    class="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                    @click="prefillFromCatalog(item)"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">{{ item.name }}</span>
                      <Badge variant="outline">{{ item.unit }}</Badge>
                    </div>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ [item.category, item.sub_category].filter(Boolean).join(' · ') }}
                      {{ item.default_price ? `· TZS ${item.default_price.toLocaleString()}` : '' }}
                    </p>
                  </button>
                </div>
              </div>

              <Separator v-if="showCatalogPanel" />
            </template>

            <!-- Variant context banner -->
            <div
              v-if="isAddingVariant"
              class="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex flex-col gap-0.5"
            >
              <p class="text-sm font-medium">Variant of: {{ parentProductForVariant?.name }}</p>
              <p class="text-xs text-muted-foreground">
                Give this variant a clear label so cashiers know which one they are selling.
              </p>
            </div>

            <!-- Image upload -->
            <div class="flex flex-col gap-2">
              <Label for="product-image">
                Product Image
                <span class="text-muted-foreground text-xs ml-1">(optional)</span>
              </Label>
              <div class="flex items-center gap-4">
                <div
                  class="size-20 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden"
                >
                  <img
                    v-if="imagePreview"
                    :src="imagePreview"
                    alt="Preview"
                    class="size-full object-cover"
                  />
                  <ImageOff v-else class="size-8 text-muted-foreground/30" />
                </div>
                <div class="flex flex-col gap-2">
                  <input
                    id="product-image"
                    ref="imageInputRef"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    @change="onImageFileChange"
                  />
                  <Button variant="outline" size="sm" type="button" @click="imageInputRef?.click()">
                    <Upload class="mr-2 h-4 w-4" />
                    Choose Image
                  </Button>
                  <Button
                    v-if="imagePreview"
                    variant="ghost"
                    size="sm"
                    type="button"
                    class="text-destructive hover:text-destructive"
                    @click="removeImage"
                  >
                    <X class="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                  <p class="text-xs text-muted-foreground">PNG, JPG or WebP · max 2 MB</p>
                </div>
              </div>
            </div>

            <Separator />

            <!-- Core fields -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="name">Product Name *</Label>
                <Input
                  id="name"
                  v-model="formData.name"
                  placeholder="e.g. Coca Cola 500ml"
                  :disabled="isAddingVariant"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="sku">SKU *</Label>
                <Input id="sku" v-model="formData.sku" placeholder="e.g. COCA-500-RED" />
              </div>
            </div>

            <div v-if="isAddingVariant" class="flex flex-col gap-1.5">
              <Label for="variant-label">Variant Label *</Label>
              <Input
                id="variant-label"
                v-model="formData.variant_label"
                placeholder="e.g. Red / Large"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="barcode">
                  Barcode
                  <span class="text-muted-foreground text-xs ml-1">(optional)</span>
                </Label>
                <Input id="barcode" v-model="formData.barcode" placeholder="Scan or type" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="category">Category</Label>
                <Input id="category" v-model="formData.category" placeholder="e.g. Drinks" />
              </div>
            </div>

            <Separator />

            <!-- Pricing -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="price">Selling Price (TZS) *</Label>
                <Input
                  id="price"
                  v-model="formData.price"
                  placeholder="TZS 1,000"
                  @input="handlePriceInput('price', $event)"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="cost-price">Cost Price (TZS) *</Label>
                <Input
                  id="cost-price"
                  v-model="formData.cost_price"
                  placeholder="TZS 700"
                  @input="handlePriceInput('cost_price', $event)"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="wholesale-price">
                  Wholesale Price
                  <span class="text-muted-foreground text-xs ml-1">(optional)</span>
                </Label>
                <Input
                  id="wholesale-price"
                  v-model="formData.wholesale_price"
                  placeholder="TZS 850"
                  @input="handlePriceInput('wholesale_price', $event)"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="wholesale-min">Min Wholesale Qty</Label>
                <Input
                  id="wholesale-min"
                  v-model="formData.wholesale_min"
                  type="number"
                  min="1"
                />
              </div>
            </div>

            <Separator />

            <!-- Stock -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="quantity">Opening Stock</Label>
                <Input id="quantity" v-model="formData.quantity" type="number" min="0" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="min-stock">Alert Below</Label>
                <Input id="min-stock" v-model="formData.min_stock" type="number" min="0" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="unit">Unit</Label>
                <Input id="unit" v-model="formData.unit" placeholder="pcs, btl, kg" />
              </div>
            </div>

            <Separator />

            <!-- Extra fields -->
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div>
                  <Label for="extra-details">Extra Details</Label>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    Add any other info for this product.
                  </p>
                </div>
                <Button variant="outline" size="sm" type="button" @click="addMetadataField">
                  + Add Field
                </Button>
              </div>
              <div
                v-for="(field, index) in metadataFields"
                :key="index"
                class="flex gap-2 items-center"
              >
                <Input v-model="field.key" placeholder="Field name" class="w-2/5" />
                <Input v-model="field.value" placeholder="Value" class="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  class="text-destructive hover:text-destructive shrink-0"
                  @click="removeMetadataField(index)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <!-- ── Add-ons tab ───────────────────────────────────────────── -->
          <TabsContent value="addons" class="flex flex-col gap-4 mt-4">
            <div class="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
              <p class="text-sm font-medium">Add a new add-on</p>
              <div class="flex gap-2 flex-wrap sm:flex-nowrap">
                <Input
                  v-model="newAddonName"
                  placeholder="Name (e.g. Delivery, Warranty)"
                  class="flex-1"
                />
                <Input
                  v-model="newAddonPrice"
                  placeholder="Extra price (TZS)"
                  class="w-full sm:w-40"
                />
                <Button
                  type="button"
                  :disabled="addonLoading || !newAddonName.trim()"
                  @click="handleCreateAddon"
                >
                  <Plus class="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div
              v-if="addons.length === 0"
              class="py-10 text-center text-sm text-muted-foreground"
            >
              No add-ons yet. Add one above.
            </div>

            <div v-else class="flex flex-col gap-2">
              <div
                v-for="addon in addons"
                :key="addon.id"
                class="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div class="flex flex-col gap-0.5">
                  <p class="text-sm font-medium">{{ addon.name }}</p>
                  <p class="text-xs text-muted-foreground">+ {{ formatCurrency(addon.price) }}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-destructive hover:text-destructive"
                  :disabled="addonLoading"
                  @click="handleDeleteAddon(addon)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showProductDialog = false">Cancel</Button>
          <Button
            v-if="activeDialogTab === 'details'"
            @click="handleSubmit"
            :disabled="loading"
          >
            {{
              isEditing
                ? 'Save Changes'
                : isAddingVariant
                ? 'Create Variant'
                : 'Add Product'
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Delete confirmation ─────────────────────────────────────────── -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{{ selectedProduct?.name }}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the product from your inventory. This cannot be undone.
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

    <!-- ── Upload dialog ───────────────────────────────────────────────── -->
    <Dialog v-model:open="showUploadDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Products from Excel</DialogTitle>
          <DialogDescription>
            Upload a filled Excel file to add multiple products at once.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 py-2">
          <div class="flex flex-col gap-1.5">
            <Label for="upload-file">Excel File (.xlsx)</Label>
            <Input
              id="upload-file"
              type="file"
              accept=".xlsx,.xls"
              @change="handleFileUpload"
            />
          </div>
          <Button variant="outline" size="sm" class="self-start" @click="downloadTemplate">
            <Download class="mr-2 h-4 w-4" />
            Download Template First
          </Button>
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