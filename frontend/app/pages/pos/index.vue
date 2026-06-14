<script setup lang="ts">
import {
  Search,
  Barcode,
  Plus,
  Minus,
  ShoppingCart,
  Banknote,
  CreditCard,
  Smartphone,
  Check,
  Printer,
  ImageOff,
  X,
  Puzzle,
  Monitor,
  Hash,
  Delete,
  ChevronRight,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import type { Product, ProductAddon } from '@/composables/useProducts'
import { useProducts } from '@/composables/useProducts'
import { useAddons } from '@/composables/useAddons'
import { useDiscounts } from '@/composables/useDiscounts'
import { useSales } from '@/composables/useSales'
import { usePrint } from '@/composables/usePrint'

// ── Types ─────────────────────────────────────────────────────────────────

interface SelectedAddon {
  id: number
  name: string
  price: number
}

interface CartItem {
  productId: number
  name: string
  sku: string
  image: string | null
  price: number
  wholesalePrice: number | null
  wholesaleMin: number
  quantity: number
  isWholesale: boolean
  availableStock: number
  manualDiscountPercent: number
  appliedOfferName: string | null
  selectedAddons: SelectedAddon[]
}

interface CartSlot {
  items: CartItem[]
  paymentLines: PaymentLine[]
  amountPaid: number
  note: string
}

type PaymentMethod = 'cash' | 'card' | 'mobile'

interface PaymentLine {
  method: PaymentMethod
  amount: number
  confirmed: boolean
}

// ── Composables ───────────────────────────────────────────────────────────
const { user } = useAuth()
const { fetchUserPermissions } = usePermissions()


const { products, fetchProducts } = useProducts()
const { addons: productAddons, fetchAddons } = useAddons()
const { fetchActiveDiscount } = useDiscounts()
const { createSale, loading: saleLoading } = useSales()
const { printerEnabled, autoPrint, fetchPrinterStatus, printReceipt: sendPrintRequest } = usePrint()

// ── Cart state — 3 independent slots ─────────────────────────────────────

const SLOT_COUNT = 3

const createEmptySlot = (): CartSlot => ({
  items: [],
  paymentLines: [{ method: 'cash', amount: 0, confirmed: false }],
  amountPaid: 0,
  note: '',
})

const loadPersistedCart = (): { slots: CartSlot[]; activeIndex: number; visibleCount: number } => {
  if (!import.meta.client) {
    return {
      slots: Array.from({ length: SLOT_COUNT }, () => createEmptySlot()),
      activeIndex: 0,
      visibleCount: 1,
    }
  }

  try {
    const raw = localStorage.getItem('pos-cart-state')
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw)
    return {
      slots: parsed.slots ?? Array.from({ length: SLOT_COUNT }, () => createEmptySlot()),
      activeIndex: parsed.activeIndex ?? 0,
      visibleCount: parsed.visibleCount ?? 1,
    }
  } catch {
    return {
      slots: Array.from({ length: SLOT_COUNT }, () => createEmptySlot()),
      activeIndex: 0,
      visibleCount: 1,
    }
  }
}

const persistedCart = loadPersistedCart()

const cartSlots = ref<CartSlot[]>(persistedCart.slots)
const activeSlotIndex = ref(persistedCart.activeIndex)
const visibleSlotCount = ref(persistedCart.visibleCount)
const activeSlot = computed(() => cartSlots.value[activeSlotIndex.value]!)

// A slot tab is visible if it is within the visible count OR it has items
// (safety net — ensures a paused slot is never hidden)
const visibleSlots = computed(() =>
  cartSlots.value
    .map((slot, index) => ({ slot, index }))
    .filter(({ index }) => index < visibleSlotCount.value),
)

// ── Sale success state ────────────────────────────────────────────────────

const lastReceiptNumber = ref('')
const lastChange = ref(0)
const lastSaleId = ref<number | null>(null)
const showingSuccess = ref(false)

// ── Search ────────────────────────────────────────────────────────────────

const searchQuery = ref('')
const barcodeQuery = ref('')
const barcodeInputRef = ref<HTMLInputElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// ── Variant picker ────────────────────────────────────────────────────────

const showVariantDialog = ref(false)
const variantParentProduct = ref<Product | null>(null)
const variantOptions = ref<Product[]>([])

// ── Addon picker ──────────────────────────────────────────────────────────

const showAddonDialog = ref(false)
const addonTargetProduct = ref<Product | null>(null)
const addonSelections = ref<SelectedAddon[]>([])
const addonDialogLoading = ref(false)

// ── Checkout confirmation ─────────────────────────────────────────────────

const showConfirmDialog = ref(false)

// ── On-screen numpad ──────────────────────────────────────────────────────

const numpadEnabled = ref(false)
const numpadTarget = ref<'cash' | 'card' | 'mobile' | null>(null)
const numpadBuffer = ref('')

// ── Customer display ──────────────────────────────────────────────────────

const customerDisplayEnabled = ref(false)

// ── Computed: filtered products ───────────────────────────────────────────

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []
  return products.value
    .filter(
      product =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query),
    )
    .slice(0, 20)
})

// ── Computed: cart totals ─────────────────────────────────────────────────

const cartSubtotal = computed(() => {
  return activeSlot.value.items.reduce((sum, item) => {
    const basePrice = item.isWholesale && item.wholesalePrice
      ? item.wholesalePrice
      : item.price

    const addonTotal = item.selectedAddons.reduce((addonSum, addon) => addonSum + addon.price, 0)
    const priceWithAddons = basePrice + addonTotal

    const discountMultiplier = 1 - item.manualDiscountPercent / 100
    const finalUnitPrice = priceWithAddons * discountMultiplier

    return sum + finalUnitPrice * item.quantity
  }, 0)
})

const cartTotal = computed(() => cartSubtotal.value)

const totalItemCount = computed(() =>
  activeSlot.value.items.reduce((sum, item) => sum + item.quantity, 0),
)

const slotItemCounts = computed(() =>
  cartSlots.value.map(slot =>
    slot.items.reduce((sum, item) => sum + item.quantity, 0),
  ),
)

// ── Computed: payment ─────────────────────────────────────────────────────

const paymentLinesTotal = computed(() =>
  activeSlot.value.paymentLines.reduce((sum, line) => sum + (line.amount || 0), 0),
)

const changeAmount = computed(() => {
  const overpayment = paymentLinesTotal.value - cartTotal.value
  return Math.max(0, overpayment)
})

const hasPendingMobileConfirmation = computed(() =>
  activeSlot.value.paymentLines.some(
    line => line.method === 'mobile' && !line.confirmed,
  ),
)

const canCheckout = computed(() => {
  if (activeSlot.value.items.length === 0) return false
  if (Math.abs(paymentLinesTotal.value - cartTotal.value) > 0.01 && paymentLinesTotal.value < cartTotal.value) return false
  if (hasPendingMobileConfirmation.value) return false
  return true
})

// ── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(async () => {
  if (user.value) await fetchUserPermissions(user.value.id)
  await Promise.all([fetchProducts(), fetchPrinterStatus()])
  loadSettings()
})

const loadSettings = () => {
  if (import.meta.client) {
    numpadEnabled.value = localStorage.getItem('pos-numpad-enabled') === 'true'
    customerDisplayEnabled.value = localStorage.getItem('pos-customer-display') === 'true'
  }
}

const persistCart = () => {
  if (!import.meta.client) return
  localStorage.setItem(
    'pos-cart-state',
    JSON.stringify({
      slots: cartSlots.value,
      activeIndex: activeSlotIndex.value,
      visibleCount: visibleSlotCount.value,
    }),
  )
}

watch(cartSlots, persistCart, { deep: true })
watch(activeSlotIndex, persistCart)
watch(visibleSlotCount, persistCart)

// ── Customer display sync ─────────────────────────────────────────────────

watch(
  () => activeSlot.value.items,
  items => {
    if (!customerDisplayEnabled.value || !import.meta.client) return
    localStorage.setItem(
      'pos-display-data',
      JSON.stringify({
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: getEffectiveUnitPrice(item),
          lineTotal: getEffectiveUnitPrice(item) * item.quantity,
        })),
        total: cartTotal.value,
        updatedAt: Date.now(),
      }),
    )
  },
  { deep: true },
)

// ── Effective price helpers ───────────────────────────────────────────────

const getEffectiveUnitPrice = (item: CartItem): number => {
  const basePrice = item.isWholesale && item.wholesalePrice
    ? item.wholesalePrice
    : item.price

  const addonTotal = item.selectedAddons.reduce((sum, addon) => sum + addon.price, 0)
  const priceWithAddons = basePrice + addonTotal
  const discountMultiplier = 1 - item.manualDiscountPercent / 100

  return priceWithAddons * discountMultiplier
}

const getLineTotalPrice = (item: CartItem): number =>
  getEffectiveUnitPrice(item) * item.quantity

// ── Format helpers ────────────────────────────────────────────────────────

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(value)

// ── Barcode handler ───────────────────────────────────────────────────────

const handleBarcodeInput = () => {
  const barcode = barcodeQuery.value.trim()
  if (!barcode) return

  const matchedProduct = products.value.find(
    product => product.barcode === barcode || product.sku === barcode,
  )

  if (matchedProduct) {
    handleProductTapped(matchedProduct)
    barcodeQuery.value = ''
  } else {
    toast.error('Product not found', { description: `No match for "${barcode}"` })
    barcodeQuery.value = ''
  }
}

// ── Product tapped — decides variant picker, addon picker, or direct add ──

const handleProductTapped = async (product: Product) => {
  if (product.quantity <= 0) {
    toast.error(`${product.name} is out of stock`)
    return
  }

  if (product.parent_id == null && product.variants && product.variants.length > 0) {
    variantParentProduct.value = product
    variantOptions.value = product.variants
    showVariantDialog.value = true
    return
  }

  await resolveAddonsAndAdd(product)
}

const handleVariantSelected = async (variant: Product) => {
  showVariantDialog.value = false
  variantParentProduct.value = null
  variantOptions.value = []
  await resolveAddonsAndAdd(variant)
}

// ── Check for addons before adding to cart ────────────────────────────────

const resolveAddonsAndAdd = async (product: Product) => {
  addonDialogLoading.value = true
  await fetchAddons(product.id)
  addonDialogLoading.value = false

  if (productAddons.value.length > 0) {
    addonTargetProduct.value = product
    addonSelections.value = []
    showAddonDialog.value = true
    return
  }

  await addToCart(product, [])
}

const handleAddonConfirmed = async () => {
  showAddonDialog.value = false
  if (!addonTargetProduct.value) return
  await addToCart(addonTargetProduct.value, addonSelections.value)
  addonTargetProduct.value = null
  addonSelections.value = []
}

const toggleAddonSelection = (addon: ProductAddon) => {
  const existingIndex = addonSelections.value.findIndex(selected => selected.id === addon.id)
  if (existingIndex === -1) {
    addonSelections.value.push({ id: addon.id, name: addon.name, price: addon.price })
  } else {
    addonSelections.value.splice(existingIndex, 1)
  }
}

const isAddonSelected = (addon: ProductAddon): boolean =>
  addonSelections.value.some(selected => selected.id === addon.id)

// ── Add to cart ───────────────────────────────────────────────────────────

const addToCart = async (product: Product, selectedAddons: SelectedAddon[]) => {
  const existingItem = activeSlot.value.items.find(item => item.productId === product.id)

  if (existingItem) {
    if (existingItem.quantity >= product.quantity) {
      toast.error('Not enough stock')
      return
    }
    existingItem.quantity++
    existingItem.isWholesale = Boolean(
      product.wholesale_price && existingItem.quantity >= (product.wholesale_min || 10),
    )
  } else {
    const appliedOffer = await fetchActiveDiscount(product.id, product.price)

    const computeOfferDiscountPercent = (): number => {
      if (!appliedOffer) return 0
      if (appliedOffer.discount_type === 'percent') return appliedOffer.value
      return (appliedOffer.value / product.price) * 100
    }

    const newItem: CartItem = {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      image: product.image ?? null,
      price: product.price,
      wholesalePrice: product.wholesale_price ?? null,
      wholesaleMin: product.wholesale_min || 10,
      quantity: 1,
      isWholesale: false,
      availableStock: product.quantity,
      manualDiscountPercent: computeOfferDiscountPercent(),
      appliedOfferName: appliedOffer ? appliedOffer.name : null,
      selectedAddons,
    }

    activeSlot.value.items.push(newItem)
  }

  syncPaymentAmountForCash()
  searchQuery.value = ''
}

// ── Cart item actions ─────────────────────────────────────────────────────

const incrementItem = (item: CartItem) => {
  if (item.quantity >= item.availableStock) {
    toast.error('Not enough stock')
    return
  }
  item.quantity++
  item.isWholesale = Boolean(
    item.wholesalePrice && item.quantity >= item.wholesaleMin,
  )
  syncPaymentAmountForCash()
}

const decrementItem = (item: CartItem) => {
  if (item.quantity <= 1) {
    removeItem(item)
    return
  }
  item.quantity--
  item.isWholesale = Boolean(
    item.wholesalePrice && item.quantity >= item.wholesaleMin,
  )
  syncPaymentAmountForCash()
}

const setItemQuantity = (item: CartItem, rawValue: string) => {
  const parsedQuantity = Number.parseInt(rawValue)
  if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
    removeItem(item)
    return
  }
  if (parsedQuantity > item.availableStock) {
    toast.error('Not enough stock')
    return
  }
  item.quantity = parsedQuantity
  item.isWholesale = Boolean(
    item.wholesalePrice && item.quantity >= item.wholesaleMin,
  )
  syncPaymentAmountForCash()
}

const removeItem = (item: CartItem) => {
  activeSlot.value.items = activeSlot.value.items.filter(
    cartItem => cartItem.productId !== item.productId,
  )
  syncPaymentAmountForCash()
}

const clearActiveCart = () => {
  cartSlots.value[activeSlotIndex.value] = createEmptySlot()
  showingSuccess.value = false

  // If we cleared a slot that was not the first, collapse the tab bar
  // back so empty slots do not linger as visible tabs
  if (activeSlotIndex.value > 0) {
    activeSlotIndex.value = activeSlotIndex.value - 1
    visibleSlotCount.value = Math.max(1, visibleSlotCount.value - 1)
  }
}

// pauseCart — saves the current cart and opens the next available slot.
// The tab for the paused cart stays visible so the cashier can return to it.
const pauseCart = () => {
  if (activeSlot.value.items.length === 0) {
    toast.error('Nothing in cart to pause')
    return
  }
  if (visibleSlotCount.value >= SLOT_COUNT) {
    toast.error('All 3 carts are in use — complete or clear one first')
    return
  }

  const nextIndex = visibleSlotCount.value
  visibleSlotCount.value++
  activeSlotIndex.value = nextIndex
  showingSuccess.value = false
  toast.success(`Cart ${activeSlotIndex.value} paused — now on Cart ${nextIndex + 1}`)
}

// ── Payment lines ─────────────────────────────────────────────────────────

const addPaymentLine = (method: PaymentMethod) => {
  const alreadyExists = activeSlot.value.paymentLines.some(line => line.method === method)
  if (alreadyExists) return
  activeSlot.value.paymentLines.push({ method, amount: 0, confirmed: false })
}

const removePaymentLine = (index: number) => {
  if (activeSlot.value.paymentLines.length <= 1) return
  activeSlot.value.paymentLines.splice(index, 1)
}

const confirmMobilePayment = (index: number) => {
  const line = activeSlot.value.paymentLines[index]
  if (line) line.confirmed = true
  toast.success('Mobile payment confirmed')
}

const syncPaymentAmountForCash = () => {
  const cashLine = activeSlot.value.paymentLines.find(line => line.method === 'cash')
  if (cashLine && activeSlot.value.paymentLines.length === 1) {
    cashLine.amount = cartTotal.value
  }
}

const availablePaymentMethods = computed(() => {
  const usedMethods = new Set(activeSlot.value.paymentLines.map(line => line.method))
  return (['cash', 'card', 'mobile'] as const).filter(method => !usedMethods.has(method))
})

// ── Numpad ────────────────────────────────────────────────────────────────

const openNumpad = (method: PaymentMethod) => {
  if (!numpadEnabled.value) return
  numpadTarget.value = method
  const existingLine = activeSlot.value.paymentLines.find(line => line.method === method)
  numpadBuffer.value = existingLine?.amount ? String(existingLine.amount) : ''
}

const numpadPress = (key: string) => {
  if (key === 'DEL') {
    numpadBuffer.value = numpadBuffer.value.slice(0, -1)
  } else if (key === 'C') {
    numpadBuffer.value = ''
  } else {
    if (numpadBuffer.value.length >= 10) return
    numpadBuffer.value += key
  }
}

const numpadConfirm = () => {
  if (!numpadTarget.value) return
  const value = Number.parseFloat(numpadBuffer.value) || 0
  const targetLine = activeSlot.value.paymentLines.find(
    line => line.method === numpadTarget.value,
  )
  if (targetLine) targetLine.amount = value
  numpadTarget.value = null
  numpadBuffer.value = ''
}

const numpadKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', 'DEL']

// ── Customer display ──────────────────────────────────────────────────────

const openCustomerDisplay = () => {
  if (import.meta.client) {
    globalThis.open('/display', '_blank', 'width=1024,height=768')
  }
}

const toggleCustomerDisplay = () => {
  customerDisplayEnabled.value = !customerDisplayEnabled.value
  if (import.meta.client) {
    localStorage.setItem('pos-customer-display', String(customerDisplayEnabled.value))
  }
}

const toggleNumpad = () => {
  numpadEnabled.value = !numpadEnabled.value
  if (import.meta.client) {
    localStorage.setItem('pos-numpad-enabled', String(numpadEnabled.value))
  }
  toast.success(numpadEnabled.value ? 'Numpad enabled' : 'Numpad disabled')
}

// ── Checkout ──────────────────────────────────────────────────────────────

const processCheckout = async () => {
  showConfirmDialog.value = false

  const saleItems = activeSlot.value.items.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    isWholesale: item.isWholesale,
    unitPrice: getEffectiveUnitPrice(item),
  }))

  const primaryPaymentLine = activeSlot.value.paymentLines[0]!
  const paymentType = activeSlot.value.paymentLines.length === 1
    ? primaryPaymentLine.method
    : 'cash'

  try {
    const result = await createSale({
      items: saleItems,
      paymentType,
      saleType: activeSlot.value.items.some(item => item.isWholesale) ? 'wholesale' : 'retail',
      amountPaid: paymentType === 'cash' ? paymentLinesTotal.value : undefined,
      useEfd: true,
    })

    if (result) {
      lastReceiptNumber.value = result.receipt_number
      lastChange.value = result.change || 0
      lastSaleId.value = result.id
      showingSuccess.value = true

      if (changeAmount.value > 0) {
        toast.success('Sale complete!', {
          description: `Change: ${formatCurrency(changeAmount.value)}`,
          duration: 6000,
        })
      } else {
        toast.success('Sale complete!', {
          description: `Receipt: ${result.receipt_number}`,
          duration: 4000,
        })
      }

      if (printerEnabled.value && autoPrint.value) {
        await sendPrintRequest(result.id, true)
      }

      setTimeout(() => {
        clearActiveCart()
      }, 3500)
    }
  } catch {
    // toast already shown in composable
  }
}

const printReceipt = async () => {
  if (!lastSaleId.value) return
  await sendPrintRequest(lastSaleId.value, true)
}

// ── Payment method label/icon helpers ────────────────────────────────────

const paymentMethodLabel = (method: string): string => {
  if (method === 'cash') return 'Cash'
  if (method === 'card') return 'Card'
  if (method === 'mobile') return 'Mobile Money'
  return method
}

const paymentMethodIcon = (method: string) => {
  if (method === 'card') return CreditCard
  if (method === 'mobile') return Smartphone
  return Banknote
}
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-background">

    <!-- ── Top bar ──────────────────────────────────────────────────────── -->
    <header class="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background">
      <div class="flex items-center gap-2">
        <ShoppingCart class="h-5 w-5 text-muted-foreground" />
        <span class="font-semibold text-sm">Point of Sale</span>
      </div>

      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" @click="toggleNumpad">
          <Hash class="h-4 w-4 mr-1.5" />
          {{ numpadEnabled ? 'Numpad On' : 'Numpad Off' }}
        </Button>
        <Button variant="ghost" size="sm" @click="toggleCustomerDisplay">
          <Monitor class="h-4 w-4 mr-1.5" />
          {{ customerDisplayEnabled ? 'Display On' : 'Display Off' }}
        </Button>
        <Button
          v-if="customerDisplayEnabled"
          variant="outline"
          size="sm"
          @click="openCustomerDisplay"
        >
          <Monitor class="h-4 w-4 mr-1.5" />
          Open Screen
        </Button>
        <Button variant="ghost" size="sm" @click="$router.push('/sales')">
          Sales History
        </Button>
      </div>
    </header>

    <!-- ── Cart slot tabs ───────────────────────────────────────────────── -->
    <div class="flex items-center gap-1 px-4 py-2 border-b shrink-0 bg-muted/30">
      <button
        v-for="{ slot, index } in visibleSlots"
        :key="index"
        class="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
        :class="activeSlotIndex === index
          ? 'bg-background border shadow-sm text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'"
        @click="activeSlotIndex = index; showingSuccess = false"
      >
        Cart {{ index + 1 }}
        <span
          v-if="slotItemCounts[index] > 0"
          class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
          :class="activeSlotIndex === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
        >
          {{ slotItemCounts[index] }}
        </span>
      </button>
    </div>

    <!-- ── Main content ─────────────────────────────────────────────────── -->
    <div class="flex flex-1 overflow-hidden">

      <!-- Left: product search + grid -->
      <div class="flex flex-col flex-1 overflow-hidden border-r">

        <!-- Search bar -->
        <div class="flex gap-2 p-3 border-b shrink-0">
          <div class="relative flex-1">
            <Barcode class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref="barcodeInputRef"
              v-model="barcodeQuery"
              placeholder="Scan barcode or SKU..."
              class="pl-9"
              @keyup.enter="handleBarcodeInput"
            />
          </div>
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref="searchInputRef"
              v-model="searchQuery"
              placeholder="Search products..."
              class="pl-9"
            />
          </div>
        </div>

        <!-- Product grid -->
        <ScrollArea class="flex-1">
          <div class="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            <button
              v-for="product in filteredProducts"
              :key="product.id"
              class="flex flex-col items-start rounded-lg border bg-card text-left transition-all hover:border-primary hover:shadow-sm active:scale-[0.98] overflow-hidden"
              :class="product.quantity <= 0 ? 'opacity-40 pointer-events-none' : ''"
              @click="handleProductTapped(product)"
            >
              <!-- Image frame -->
              <div class="w-full aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                <img
                  v-if="product.image"
                  :src="product.image"
                  :alt="product.name"
                  class="w-full h-full object-cover"
                />
                <ImageOff v-else class="size-10 text-muted-foreground/25" />

                <!-- Out of stock overlay -->
                <div
                  v-if="product.quantity <= 0"
                  class="absolute inset-0 bg-background/70 flex items-center justify-center"
                >
                  <Badge variant="destructive" class="text-xs">Out of Stock</Badge>
                </div>

                <!-- Variant indicator -->
                <div
                  v-if="product.variants && product.variants.length > 0"
                  class="absolute top-1.5 right-1.5"
                >
                  <Badge variant="secondary" class="text-xs px-1.5">
                    {{ product.variants.length }} variants
                  </Badge>
                </div>

                <!-- Low stock warning -->
                <div
                  v-if="product.quantity > 0 && product.quantity <= product.min_stock"
                  class="absolute bottom-0 left-0 right-0 bg-orange-500/80 text-white text-xs text-center py-0.5"
                >
                  Low: {{ product.quantity }} left
                </div>
              </div>

              <!-- Info -->
              <div class="p-2 w-full flex flex-col gap-0.5">
                <p class="text-sm font-semibold truncate leading-tight">{{ product.name }}</p>
                <p class="text-xs text-muted-foreground font-mono truncate">{{ product.sku }}</p>
                <p class="text-sm font-bold mt-0.5 text-primary">{{ formatCurrency(product.price) }}</p>
              </div>
            </button>

            <!-- No query yet — prompt the cashier -->
            <div
              v-if="!searchQuery.trim() && filteredProducts.length === 0"
              class="col-span-full py-16 text-center text-muted-foreground"
            >
              <Barcode class="size-10 mx-auto mb-3 opacity-25" />
              <p class="text-sm font-medium">Scan a barcode or search by name</p>
              <p class="text-xs mt-1 opacity-60">Products will appear here</p>
            </div>

            <!-- Query with no match -->
            <div
              v-else-if="searchQuery.trim() && filteredProducts.length === 0"
              class="col-span-full py-16 text-center text-muted-foreground"
            >
              <Search class="size-10 mx-auto mb-3 opacity-30" />
              <p class="text-sm">No products found for "{{ searchQuery }}"</p>
            </div>
          </div>
        </ScrollArea>
      </div>

      <!-- Right: cart + payment -->
      <div class="flex flex-col w-[400px] xl:w-[440px] shrink-0 overflow-hidden">

        <!-- Cart items -->
        <ScrollArea class="flex-1 border-b">
          <!-- Empty cart -->
          <div
            v-if="activeSlot.items.length === 0 && !showingSuccess"
            class="h-full flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
          >
            <ShoppingCart class="size-12 opacity-20" />
            <p class="text-sm">Cart is empty</p>
            <p class="text-xs">Scan or tap a product to begin</p>
          </div>

          <!-- Success state -->
          <div
            v-else-if="showingSuccess"
            class="h-full flex flex-col items-center justify-center gap-3 py-12 text-center px-6"
          >
            <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check class="size-8 text-primary" />
            </div>
            <p class="text-xl font-bold">Sale Complete!</p>
            <p class="text-sm text-muted-foreground">Receipt: {{ lastReceiptNumber }}</p>
            <p
              v-if="lastChange > 0"
              class="text-2xl font-bold"
            >
              Change: {{ formatCurrency(lastChange) }}
            </p>
            <div class="flex gap-2 mt-2">
              <Button
                v-if="printerEnabled"
                variant="outline"
                size="sm"
                @click="printReceipt"
              >
                <Printer class="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
              <Button size="sm" @click="clearActiveCart">
                Next Customer
              </Button>
            </div>
          </div>

          <!-- Cart items list -->
          <div v-else class="flex flex-col gap-2 p-3">
            <div
              v-for="item in activeSlot.items"
              :key="item.productId"
              class="rounded-lg border bg-card overflow-hidden"
            >
              <div class="flex items-start gap-3 p-3">
                <!-- Product image thumbnail -->
                <div class="size-12 rounded-md border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                  <img
                    v-if="item.image"
                    :src="item.image"
                    :alt="item.name"
                    class="size-full object-cover"
                  />
                  <ImageOff v-else class="size-5 text-muted-foreground/30" />
                </div>

                <!-- Item info -->
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm truncate">{{ item.name }}</p>
                  <p class="text-xs text-muted-foreground font-mono">{{ item.sku }}</p>

                  <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge v-if="item.isWholesale" variant="secondary" class="text-xs">Wholesale</Badge>
                    <Badge
                      v-if="item.appliedOfferName"
                      variant="outline"
                      class="text-xs border-primary/40 text-primary"
                    >
                      {{ item.appliedOfferName }}
                    </Badge>
                    <span v-if="item.selectedAddons.length > 0" class="text-xs text-muted-foreground">
                      + {{ item.selectedAddons.map(addon => addon.name).join(', ') }}
                    </span>
                  </div>
                </div>

                <!-- Remove -->
                <Button
                  variant="ghost"
                  size="icon"
                  class="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8"
                  @click="removeItem(item)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>

              <!-- Quantity + price row -->
              <div class="flex items-center gap-2 px-3 pb-3">
                <Button
                  variant="outline"
                  size="icon"
                  class="h-8 w-8 shrink-0"
                  @click="decrementItem(item)"
                >
                  <Minus class="h-3 w-3" />
                </Button>

                <Input
                  :model-value="item.quantity"
                  @input="setItemQuantity(item, ($event.target as HTMLInputElement).value)"
                  type="number"
                  min="1"
                  class="w-14 h-8 text-center text-sm p-1"
                />

                <Button
                  variant="outline"
                  size="icon"
                  class="h-8 w-8 shrink-0"
                  @click="incrementItem(item)"
                >
                  <Plus class="h-3 w-3" />
                </Button>

                <!-- Manual discount % -->
                <div class="flex items-center gap-1 flex-1">
                  <Input
                    :model-value="item.manualDiscountPercent || ''"
                    @input="item.manualDiscountPercent = Number.parseFloat(($event.target as HTMLInputElement).value) || 0; syncPaymentAmountForCash()"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0%"
                    class="w-14 h-8 text-center text-sm p-1"
                  />
                  <span class="text-xs text-muted-foreground">off</span>
                </div>

                <!-- Line total -->
                <p class="text-sm font-bold ml-auto tabular-nums whitespace-nowrap">
                  {{ formatCurrency(getLineTotalPrice(item)) }}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <!-- Payment section -->
        <div class="shrink-0 flex flex-col gap-0 border-t bg-background">

          <!-- Order total -->
          <div class="flex items-center justify-between px-4 py-3 border-b">
            <span class="text-sm text-muted-foreground">
              {{ totalItemCount }} item{{ totalItemCount !== 1 ? 's' : '' }}
            </span>
            <span class="text-2xl font-bold tabular-nums">{{ formatCurrency(cartTotal) }}</span>
          </div>

          <!-- Payment lines -->
          <div class="flex flex-col gap-2 px-4 py-3 border-b">
            <div
              v-for="(line, index) in activeSlot.paymentLines"
              :key="index"
              class="flex items-center gap-2"
            >
              <component
                :is="paymentMethodIcon(line.method)"
                class="h-4 w-4 text-muted-foreground shrink-0"
              />
              <span class="text-sm font-medium w-24 shrink-0">{{ paymentMethodLabel(line.method) }}</span>

              <!-- Numpad trigger or regular input -->
              <button
                v-if="numpadEnabled"
                class="flex-1 h-9 rounded-md border bg-background px-3 text-sm text-left tabular-nums"
                :class="numpadTarget === line.method ? 'border-primary ring-1 ring-primary' : ''"
                @click="openNumpad(line.method)"
              >
                {{ line.amount > 0 ? formatCurrency(line.amount) : 'Tap to enter' }}
              </button>

              <Input
                v-else
                :model-value="line.amount || ''"
                @input="line.amount = Number.parseFloat(($event.target as HTMLInputElement).value) || 0"
                type="number"
                min="0"
                placeholder="Amount"
                class="flex-1 h-9 text-sm tabular-nums"
              />

              <!-- Mobile confirmation -->
              <Button
                v-if="line.method === 'mobile' && !line.confirmed"
                size="sm"
                variant="outline"
                class="shrink-0 text-xs h-9"
                @click="confirmMobilePayment(index)"
              >
                Confirm
              </Button>
              <Check
                v-else-if="line.method === 'mobile' && line.confirmed"
                class="h-4 w-4 text-primary shrink-0"
              />

              <!-- Remove payment line -->
              <Button
                v-if="activeSlot.paymentLines.length > 1"
                variant="ghost"
                size="icon"
                class="h-8 w-8 shrink-0 text-muted-foreground"
                @click="removePaymentLine(index)"
              >
                <X class="h-3 w-3" />
              </Button>
            </div>

            <!-- Add payment method -->
            <div v-if="availablePaymentMethods.length > 0" class="flex gap-1 flex-wrap">
              <span class="text-xs text-muted-foreground self-center">Split with:</span>
              <button
                v-for="method in availablePaymentMethods"
                :key="method"
                class="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-accent transition-colors"
                @click="addPaymentLine(method)"
              >
                <component :is="paymentMethodIcon(method)" class="h-3 w-3" />
                {{ paymentMethodLabel(method) }}
              </button>
            </div>

            <!-- Change -->
            <div
              v-if="changeAmount > 0"
              class="flex items-center justify-between rounded-md bg-primary/5 border border-primary/20 px-3 py-2"
            >
              <span class="text-sm font-medium">Change to give</span>
              <span class="text-lg font-bold tabular-nums">{{ formatCurrency(changeAmount) }}</span>
            </div>

            <!-- Pending mobile confirmation banner -->
            <div
              v-if="hasPendingMobileConfirmation"
              class="rounded-md bg-orange-500/10 border border-orange-500/20 px-3 py-2 text-sm text-orange-700 dark:text-orange-400"
            >
              Waiting for mobile payment confirmation — tap "Confirm" after the teller verifies receipt.
            </div>
          </div>

          <!-- Numpad -->
          <div v-if="numpadEnabled && numpadTarget" class="px-4 py-3 border-b">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-muted-foreground">
                Entering amount for {{ paymentMethodLabel(numpadTarget) }}
              </span>
              <span class="text-lg font-bold tabular-nums">
                {{ numpadBuffer ? formatCurrency(Number.parseFloat(numpadBuffer)) : '—' }}
              </span>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="key in numpadKeys"
                :key="key"
                class="h-12 rounded-md border text-sm font-semibold transition-colors"
                :class="key === 'DEL' || key === 'C'
                  ? 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  : 'bg-background hover:bg-accent'"
                @click="numpadPress(key)"
              >
                <Delete v-if="key === 'DEL'" class="h-4 w-4 mx-auto" />
                <X v-else-if="key === 'C'" class="h-4 w-4 mx-auto" />
                <span v-else>{{ key }}</span>
              </button>
            </div>
            <Button class="w-full mt-2" @click="numpadConfirm">
              <Check class="h-4 w-4 mr-2" />
              Set Amount
            </Button>
          </div>

          <!-- Checkout button -->
          <div class="px-4 py-3 flex gap-2">
            <Button
              variant="outline"
              class="h-12"
              :disabled="activeSlot.items.length === 0 || visibleSlotCount >= SLOT_COUNT"
              @click="pauseCart"
              :title="visibleSlotCount >= SLOT_COUNT ? 'All carts in use' : 'Pause and serve next customer'"
            >
              Pause
            </Button>
            <Button
              class="flex-1 h-12 text-base font-bold"
              :disabled="!canCheckout || saleLoading"
              @click="showConfirmDialog = true"
            >
              <ShoppingCart class="h-5 w-5 mr-2" />
              {{ saleLoading ? 'Processing...' : 'Pay Now' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Variant picker dialog ─────────────────────────────────────────── -->
    <Dialog v-model:open="showVariantDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a Variant</DialogTitle>
          <DialogDescription>
            {{ variantParentProduct?.name }} — pick the one you want to sell
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2 py-2">
          <button
            v-for="variant in variantOptions"
            :key="variant.id"
            class="flex items-center gap-4 rounded-lg border px-4 py-3 text-left hover:border-primary hover:bg-accent transition-colors"
            :class="variant.quantity <= 0 ? 'opacity-40 pointer-events-none' : ''"
            @click="handleVariantSelected(variant)"
          >
            <div class="size-12 rounded-md border bg-muted shrink-0 overflow-hidden flex items-center justify-center">
              <img
                v-if="variant.image"
                :src="variant.image"
                :alt="variant.name"
                class="size-full object-cover"
              />
              <ImageOff v-else class="size-5 text-muted-foreground/30" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold">{{ variant.variant_label || variant.name }}</p>
              <p class="text-xs text-muted-foreground font-mono">{{ variant.sku }}</p>
              <p class="text-sm font-bold text-primary mt-0.5">{{ formatCurrency(variant.price) }}</p>
            </div>
            <div class="text-right shrink-0">
              <Badge
                :variant="variant.quantity <= 0 ? 'destructive' : variant.quantity <= variant.min_stock ? 'outline' : 'secondary'"
                class="text-xs"
              >
                {{ variant.quantity <= 0 ? 'Out of Stock' : `${variant.quantity} left` }}
              </Badge>
              <ChevronRight class="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
            </div>
          </button>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showVariantDialog = false">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Addon picker dialog ───────────────────────────────────────────── -->
    <Dialog v-model:open="showAddonDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Extras?</DialogTitle>
          <DialogDescription>
            Optional add-ons for {{ addonTargetProduct?.name }}
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2 py-2">
          <div v-if="addonDialogLoading" class="py-6 text-center text-sm text-muted-foreground">
            Loading add-ons...
          </div>
          <button
            v-else
            v-for="addon in productAddons"
            :key="addon.id"
            class="flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors"
            :class="isAddonSelected(addon)
              ? 'border-primary bg-primary/5'
              : 'hover:border-primary/40 hover:bg-accent'"
            @click="toggleAddonSelection(addon)"
          >
            <div class="flex items-center gap-3">
              <div
                class="size-5 rounded border-2 flex items-center justify-center transition-colors"
                :class="isAddonSelected(addon) ? 'border-primary bg-primary' : 'border-muted-foreground/40'"
              >
                <Check v-if="isAddonSelected(addon)" class="h-3 w-3 text-primary-foreground" />
              </div>
              <div>
                <p class="text-sm font-medium">{{ addon.name }}</p>
              </div>
            </div>
            <p class="text-sm font-bold text-primary">+ {{ formatCurrency(addon.price) }}</p>
          </button>

          <div
            v-if="addonSelections.length > 0"
            class="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center justify-between"
          >
            <span class="text-muted-foreground">Add-ons total</span>
            <span class="font-semibold">
              + {{ formatCurrency(addonSelections.reduce((sum, addon) => sum + addon.price, 0)) }}
            </span>
          </div>
        </div>
        <DialogFooter class="flex gap-2">
          <Button variant="outline" @click="handleAddonConfirmed">
            Skip
          </Button>
          <Button @click="handleAddonConfirmed">
            <Puzzle class="h-4 w-4 mr-2" />
            {{ addonSelections.length > 0 ? `Add with ${addonSelections.length} extra${addonSelections.length > 1 ? 's' : ''}` : 'Add to Cart' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Checkout confirmation dialog ─────────────────────────────────── -->
    <AlertDialog v-model:open="showConfirmDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Sale</AlertDialogTitle>
          <AlertDialogDescription>
            <div class="flex flex-col gap-2 mt-1">
              <div class="flex justify-between text-sm">
                <span>Items</span>
                <span class="font-medium">{{ totalItemCount }}</span>
              </div>
              <div
                v-for="line in activeSlot.paymentLines"
                :key="line.method"
                class="flex justify-between text-sm"
              >
                <span>{{ paymentMethodLabel(line.method) }}</span>
                <span class="font-medium">{{ formatCurrency(line.amount) }}</span>
              </div>
              <Separator />
              <div class="flex justify-between font-bold">
                <span>Total</span>
                <span>{{ formatCurrency(cartTotal) }}</span>
              </div>
              <div v-if="changeAmount > 0" class="flex justify-between text-sm font-semibold">
                <span>Change</span>
                <span>{{ formatCurrency(changeAmount) }}</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction @click="processCheckout" :disabled="saleLoading">
            Confirm & Complete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>
</template>