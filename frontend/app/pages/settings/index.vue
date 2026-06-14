<script setup lang="ts">
import {
  Building2,
  Settings2,
  Wifi,
  Bell,
  Printer,
  Calculator,
  Save,
  Upload,
  Phone,
  MapPin,
  Hash,
  Mail,
  Volume2,
  TestTube,
} from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettings } from '~/composables/useSettings'

definePageMeta({ layout: 'default' })

const { settings, loading, testing, fetchSettings, updateSettings, testEFDConnection, uploadLogo } =
  useSettings()

// ─── Business form ─────────────────────────────────────────────────────────
// Source: settings.company.* (companies table)
const businessForm = ref({
  business_name: '',
  business_phone: '',
  business_address: '',
  business_tin: '',
  receipt_header: '',
  receipt_footer: '',
})

// ─── System form ────────────────────────────────────────────────────────────
// Source: settings.* (settings table)
const systemForm = ref({
  tax_rate: 18,
  currency: 'TZS',
  currency_symbol: 'TZS',
  date_format: 'DD/MM/YYYY',
  receipt_number_format: 'SALE-{DATE}-{COUNTER}',
})

// ─── Hardware form ──────────────────────────────────────────────────────────
// changeCounterEnabled and printerEnabled are UI-only toggles (no backend field yet).
// The three receipt booleans do map to settings table columns.
const hardwareForm = ref({
  changeCounterEnabled: false,
  printerEnabled: false,
  printerPort: 'USB',
  printerModel: '',
  print_receipt_automatically: false,
  show_tax_on_receipt: true,
  show_barcodes_on_receipt: false,
})

// ─── EFD form ───────────────────────────────────────────────────────────────
// Source: settings.* (settings table)
const efdForm = ref({
  efd_enabled: false,
  efd_endpoint: '',
  efd_api_key: '',
})

// ─── Notification form ───────────────────────────────────────────────────────
// Source: settings.* (settings table)
const notificationForm = ref({
  low_stock_threshold: 5,
  email_notifications_enabled: false,
  notification_email: '',
  alert_sound_enabled: true,
  alert_on_low_stock: true,
  alert_on_out_of_stock: true,
  alert_on_dead_stock: false,
  dead_stock_days: 30,
})

// ─── Logo ────────────────────────────────────────────────────────────────────
const logoPreview = ref<string | null>(null)
const logoFile = ref<File | null>(null)
const logoInputRef = ref<HTMLInputElement | null>(null)

// ─── Per-section saving state ─────────────────────────────────────────────────
const savingBusiness = ref(false)
const savingSystem = ref(false)
const savingHardware = ref(false)
const savingEfd = ref(false)
const savingNotifications = ref(false)

// ─── Fill every form from the API response ────────────────────────────────────
// settings.company.* → businessForm
// settings.*         → everything else
const loadForms = () => {
  if (!settings.value) return
  const s = settings.value
  const c = s.company // nested company object from the backend

  businessForm.value = {
    business_name: c.name ?? '',
    business_phone: c.phone ?? '',
    business_address: c.address ?? '',
    business_tin: c.tin ?? '',
    receipt_header: c.receipt_header ?? '',
    receipt_footer: c.receipt_footer ?? '',
  }

  systemForm.value = {
    tax_rate: s.tax_rate ?? 18,
    currency: s.currency ?? 'TZS',
    currency_symbol: s.currency_symbol ?? 'TZS',
    date_format: s.date_format ?? 'DD/MM/YYYY',
    receipt_number_format: s.receipt_number_format ?? 'SALE-{DATE}-{COUNTER}',
  }

  efdForm.value = {
    efd_enabled: s.efd_enabled ?? false,
    efd_endpoint: s.efd_endpoint ?? '',
    efd_api_key: s.efd_api_key ?? '',
  }

  notificationForm.value = {
    low_stock_threshold: s.low_stock_threshold ?? 5,
    email_notifications_enabled: s.email_notifications_enabled ?? false,
    notification_email: s.notification_email ?? '',
    alert_sound_enabled: s.alert_sound_enabled ?? true,
    alert_on_low_stock: s.alert_on_low_stock ?? true,
    alert_on_out_of_stock: s.alert_on_out_of_stock ?? true,
    alert_on_dead_stock: s.alert_on_dead_stock ?? false,
    dead_stock_days: s.dead_stock_days ?? 30,
  }

  hardwareForm.value.print_receipt_automatically = s.print_receipt_automatically ?? false
  hardwareForm.value.show_tax_on_receipt = s.show_tax_on_receipt ?? true
  hardwareForm.value.show_barcodes_on_receipt = s.show_barcodes_on_receipt ?? false

  // Show current logo if one was already uploaded
  if (c.logo) logoPreview.value = c.logo
}
const { user } = useAuth()
const { fetchUserPermissions } = usePermissions()
onMounted(async () => {
  if (user.value) await fetchUserPermissions(user.value.id)
  await fetchSettings()
  loadForms()
})

// Re-populate whenever settings refreshes (e.g. after a save returns the updated record)
watch(() => settings.value, () => loadForms())

// ─── Logo handlers ────────────────────────────────────────────────────────────
const onLogoChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  logoFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => { logoPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
}

// ─── Save: Business ──────────────────────────────────────────────────────────
// Sends: business_name, business_phone, business_address, business_tin,
//        receipt_header, receipt_footer  →  companies table via service layer
// Logo uses a separate multipart endpoint: POST /api/settings/upload-logo
const saveBusiness = async () => {
  savingBusiness.value = true
  try {
    if (logoFile.value) {
      await uploadLogo(logoFile.value)
      logoFile.value = null
    }
    await updateSettings({ ...businessForm.value })
  } finally {
    savingBusiness.value = false
  }
}

// ─── Save: System ────────────────────────────────────────────────────────────
// Sends: tax_rate, currency, currency_symbol, date_format, receipt_number_format
// → settings table
const saveSystem = async () => {
  savingSystem.value = true
  try {
    await updateSettings({ ...systemForm.value })
  } finally {
    savingSystem.value = false
  }
}

// ─── Save: Hardware ──────────────────────────────────────────────────────────
// changeCounterEnabled and printerEnabled are local UI state only.
// Only the three mapped receipt booleans are sent to the backend.
const saveHardware = async () => {
  savingHardware.value = true
  try {
    await updateSettings({
      print_receipt_automatically: hardwareForm.value.print_receipt_automatically,
      show_tax_on_receipt: hardwareForm.value.show_tax_on_receipt,
      show_barcodes_on_receipt: hardwareForm.value.show_barcodes_on_receipt,
    })
  } finally {
    savingHardware.value = false
  }
}

// ─── Save: EFD ───────────────────────────────────────────────────────────────
// Sends: efd_enabled, efd_endpoint, efd_api_key → settings table
const saveEfd = async () => {
  savingEfd.value = true
  try {
    await updateSettings({ ...efdForm.value })
  } finally {
    savingEfd.value = false
  }
}

// ─── Save: Notifications ─────────────────────────────────────────────────────
// Sends all notification fields → settings table
const saveNotifications = async () => {
  savingNotifications.value = true
  try {
    await updateSettings({ ...notificationForm.value })
  } finally {
    savingNotifications.value = false
  }
}

const handleTestEFD = async () => {
  await testEFDConnection(efdForm.value.efd_endpoint, efdForm.value.efd_api_key)
}

// ─── EFD badge ────────────────────────────────────────────────────────────────
const efdBadgeVariant = computed(() => {
  if (!settings.value?.efd_enabled) return 'secondary' as const
  return settings.value.efd_test_status === 'success' ? 'default' as const : 'destructive' as const
})
const efdBadgeLabel = computed(() => {
  if (!settings.value?.efd_enabled) return 'Disabled'
  return settings.value.efd_test_status === 'success' ? 'Connected' : 'Not Tested'
})
</script>

<template>
  <div class="flex flex-col gap-6 p-6 max-w-4xl">

    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage your business and system configuration</p>
    </div>

    <!-- Skeleton while first load -->
    <div v-if="loading && !settings" class="flex flex-col gap-3">
      <div v-for="i in 4" :key="i" class="h-28 rounded-lg bg-muted animate-pulse" />
    </div>

    <Tabs v-else default-value="business">
      <TabsList>
        <TabsTrigger value="business">
          <Building2 class="size-4 mr-2" />Business
        </TabsTrigger>
        <TabsTrigger value="system">
          <Settings2 class="size-4 mr-2" />System
        </TabsTrigger>
        <TabsTrigger value="hardware">
          <Printer class="size-4 mr-2" />Hardware
        </TabsTrigger>
        <TabsTrigger value="efd">
          <Wifi class="size-4 mr-2" />EFD
        </TabsTrigger>
        <TabsTrigger value="notifications">
          <Bell class="size-4 mr-2" />Notifications
        </TabsTrigger>
      </TabsList>

      <!-- ══════════════════════════════════════════════ -->
      <!-- BUSINESS                                       -->
      <!-- ══════════════════════════════════════════════ -->
      <TabsContent value="business" class="flex flex-col gap-4 mt-4">

        <!-- Logo card -->
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-base">Business Logo</CardTitle>
            <CardDescription>Displayed on receipts and reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center gap-4">
              <div class="size-20 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                <img v-if="logoPreview" :src="logoPreview" alt="Logo" class="size-full object-contain" />
                <Building2 v-else class="size-8 text-muted-foreground" />
              </div>
              <div class="flex flex-col gap-2">
                <input ref="logoInputRef" type="file" accept="image/png,image/jpeg" class="hidden" @change="onLogoChange" />
                <Button variant="outline" size="sm" @click="logoInputRef?.click()">
                  <Upload class="size-4 mr-2" />Choose image
                </Button>
                <p class="text-xs text-muted-foreground">PNG or JPG · max 2 MB</p>
                <p v-if="logoFile" class="text-xs text-muted-foreground truncate max-w-48">{{ logoFile.name }}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Details card -->
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-base">Business Details</CardTitle>
            <CardDescription>Saved to your company profile — shown on receipts and reports</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="business-name">Business Name</Label>
                <Input id="business-name" v-model="businessForm.business_name" placeholder="Acme Ltd." />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="business-phone">Phone Number</Label>
                <div class="relative">
                  <Phone class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="business-phone" v-model="businessForm.business_phone" class="pl-9" placeholder="+255 XXX XXX XXX" />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 max-w-xs">
              <Label for="business-tin">TIN Number</Label>
              <div class="relative">
                <Hash class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="business-tin" v-model="businessForm.business_tin" class="pl-9" placeholder="123-456-789" />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="business-address">Address</Label>
              <div class="relative">
                <MapPin class="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Textarea id="business-address" v-model="businessForm.business_address" class="pl-9 min-h-20 resize-none" placeholder="Street, City, Region" />
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-1.5">
              <Label for="receipt-header">Receipt Header</Label>
              <Textarea id="receipt-header" v-model="businessForm.receipt_header" class="min-h-16 resize-none" placeholder="e.g. Thank you for shopping with us!" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="receipt-footer">Receipt Footer</Label>
              <Textarea id="receipt-footer" v-model="businessForm.receipt_footer" class="min-h-16 resize-none" placeholder="e.g. Goods sold are not returnable." />
            </div>

            <div class="flex justify-end pt-1">
              <Button :disabled="savingBusiness" @click="saveBusiness">
                <Save class="size-4 mr-2" />
                {{ savingBusiness ? 'Saving…' : 'Save Business Info' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ══════════════════════════════════════════════ -->
      <!-- SYSTEM                                         -->
      <!-- ══════════════════════════════════════════════ -->
      <TabsContent value="system" class="flex flex-col gap-4 mt-4">
        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-base">Currency &amp; Tax</CardTitle>
            <CardDescription>Applied to all sales and reports</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="grid grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="currency-code">Currency Code</Label>
                <Select v-model="systemForm.currency">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TZS">TZS — Tanzanian Shilling</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                    <SelectItem value="UGX">UGX — Ugandan Shilling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="currency-symbol">Currency Symbol</Label>
                <Input id="currency-symbol" v-model="systemForm.currency_symbol" placeholder="TZS" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="tax-rate">Tax Rate (%)</Label>
                <Input id="tax-rate" v-model.number="systemForm.tax_rate" type="number" min="0" max="100" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-base">Date &amp; Receipt Format</CardTitle>
            <CardDescription>Controls how dates and receipt numbers are displayed</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="date-format">Date Format</Label>
                <Select v-model="systemForm.date_format">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="receipt-number-format">Receipt Number Format</Label>
                <Input id="receipt-number-format" v-model="systemForm.receipt_number_format" placeholder="SALE-{DATE}-{COUNTER}" />
                <p class="text-xs text-muted-foreground">Tokens: <code class="text-xs">{DATE}</code> · <code class="text-xs">{COUNTER}</code></p>
              </div>
            </div>
            <div class="flex justify-end pt-1">
              <Button :disabled="savingSystem" @click="saveSystem">
                <Save class="size-4 mr-2" />
                {{ savingSystem ? 'Saving…' : 'Save System Settings' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ══════════════════════════════════════════════ -->
      <!-- HARDWARE                                       -->
      <!-- ══════════════════════════════════════════════ -->
      <TabsContent value="hardware" class="flex flex-col gap-4 mt-4">

        <Card>
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-base">Change Counter</CardTitle>
                <CardDescription class="mt-0.5">Calculates and shows change owed to the customer at checkout</CardDescription>
              </div>
              <Switch v-model:checked="hardwareForm.changeCounterEnabled" />
            </div>
          </CardHeader>
          <CardContent v-if="hardwareForm.changeCounterEnabled">
            <div class="rounded-md border bg-muted/40 p-3 flex items-start gap-2">
              <Calculator class="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <p class="text-sm text-muted-foreground">When enabled, cashiers will see a <strong>Cash Received</strong> field at checkout and the system will display change automatically.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-base">Thermal Receipt Printer</CardTitle>
                <CardDescription class="mt-0.5">Connect a USB or network thermal printer</CardDescription>
              </div>
              <Switch v-model:checked="hardwareForm.printerEnabled" />
            </div>
          </CardHeader>
          <CardContent v-if="hardwareForm.printerEnabled" class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <Label for="connection-type">Connection Type</Label>
                <Select v-model="hardwareForm.printerPort">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USB">USB</SelectItem>
                    <SelectItem value="Network">Network (LAN)</SelectItem>
                    <SelectItem value="Bluetooth">Bluetooth</SelectItem>
                    <SelectItem value="Serial">Serial Port</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="printer-model">Printer Model <span class="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="printer-model" v-model="hardwareForm.printerModel" placeholder="e.g. Epson TM-T20III" />
              </div>
            </div>

            <Separator />

            <p class="text-sm font-medium">Receipt Options</p>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm">Print automatically after sale</p>
                  <p class="text-xs text-muted-foreground">No prompt — prints immediately on completion</p>
                </div>
                <Switch v-model:checked="hardwareForm.print_receipt_automatically" />
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm">Show tax on receipt</p>
                  <p class="text-xs text-muted-foreground">Display VAT as a separate line item</p>
                </div>
                <Switch v-model:checked="hardwareForm.show_tax_on_receipt" />
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm">Print barcodes on receipt</p>
                  <p class="text-xs text-muted-foreground">Include product barcodes below line items</p>
                </div>
                <Switch v-model:checked="hardwareForm.show_barcodes_on_receipt" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div class="flex justify-end">
          <Button :disabled="savingHardware" @click="saveHardware">
            <Save class="size-4 mr-2" />
            {{ savingHardware ? 'Saving…' : 'Save Hardware Settings' }}
          </Button>
        </div>
      </TabsContent>

      <!-- ══════════════════════════════════════════════ -->
      <!-- EFD                                            -->
      <!-- ══════════════════════════════════════════════ -->
      <TabsContent value="efd" class="flex flex-col gap-4 mt-4">
        <Card>
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-base flex items-center gap-2">
                  Electronic Fiscal Device
                  <Badge :variant="efdBadgeVariant">{{ efdBadgeLabel }}</Badge>
                </CardTitle>
                <CardDescription class="mt-0.5">Connect to TRA's EFD system for fiscal receipt compliance</CardDescription>
              </div>
              <Switch v-model:checked="efdForm.efd_enabled" />
            </div>
          </CardHeader>
          <CardContent v-if="efdForm.efd_enabled" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <Label for="efd-endpoint">EFD Endpoint URL</Label>
              <Input id="efd-endpoint" v-model="efdForm.efd_endpoint" placeholder="https://efd.tra.go.tz/api/v1" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="efd-api-key">API Key</Label>
              <Input id="efd-api-key" v-model="efdForm.efd_api_key" type="password" placeholder="••••••••••••••••" />
            </div>
            <p v-if="settings?.efd_last_test_date" class="text-xs text-muted-foreground">
              Last tested: {{ new Date(settings.efd_last_test_date).toLocaleString() }}
            </p>
            <div class="flex gap-2 pt-1">
              <Button variant="outline" :disabled="testing" @click="handleTestEFD">
                <TestTube class="size-4 mr-2" />
                {{ testing ? 'Testing…' : 'Test Connection' }}
              </Button>
              <Button :disabled="savingEfd" @click="saveEfd">
                <Save class="size-4 mr-2" />
                {{ savingEfd ? 'Saving…' : 'Save EFD Settings' }}
              </Button>
            </div>
          </CardContent>
          <CardContent v-else>
            <div class="rounded-md border bg-muted/40 p-3 flex items-start gap-2">
              <Wifi class="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <p class="text-sm text-muted-foreground">Enable EFD to connect this POS to the Tanzania Revenue Authority's fiscal system for compliant receipt generation.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ══════════════════════════════════════════════ -->
      <!-- NOTIFICATIONS                                  -->
      <!-- ══════════════════════════════════════════════ -->
      <TabsContent value="notifications" class="flex flex-col gap-4 mt-4">

        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-base">Alert Sound</CardTitle>
            <CardDescription>Play a sound when stock alerts are triggered in-app</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Volume2 class="size-4 text-muted-foreground" />
                <p class="text-sm">Enable notification sounds</p>
              </div>
              <Switch v-model:checked="notificationForm.alert_sound_enabled" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <CardTitle class="text-base">Stock Alerts</CardTitle>
            <CardDescription>Notifications when inventory reaches critical levels</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm">Low stock alert</p>
                <p class="text-xs text-muted-foreground">Triggers when quantity falls below the threshold</p>
              </div>
              <Switch v-model:checked="notificationForm.alert_on_low_stock" />
            </div>
            <div v-if="notificationForm.alert_on_low_stock" class="flex flex-col gap-1.5 max-w-xs">
              <Label for="low-stock-threshold">Low Stock Threshold (units)</Label>
              <Input id="low-stock-threshold" v-model.number="notificationForm.low_stock_threshold" type="number" min="1" />
            </div>

            <Separator />

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm">Out of stock alert</p>
                <p class="text-xs text-muted-foreground">Triggers when a product reaches zero units</p>
              </div>
              <Switch v-model:checked="notificationForm.alert_on_out_of_stock" />
            </div>

            <Separator />

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm">Dead stock alert</p>
                <p class="text-xs text-muted-foreground">Items with no sales movement over a set period</p>
              </div>
              <Switch v-model:checked="notificationForm.alert_on_dead_stock" />
            </div>
            <div v-if="notificationForm.alert_on_dead_stock" class="flex flex-col gap-1.5 max-w-xs">
              <Label for="dead-stock-period">Dead Stock Period (days)</Label>
              <Input id="dead-stock-period" v-model.number="notificationForm.dead_stock_days" type="number" min="1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-base">Email Notifications</CardTitle>
                <CardDescription>Receive stock alerts by email in addition to in-app</CardDescription>
              </div>
              <Switch v-model:checked="notificationForm.email_notifications_enabled" />
            </div>
          </CardHeader>
          <CardContent v-if="notificationForm.email_notifications_enabled">
            <div class="flex flex-col gap-1.5 max-w-sm">
              <Label for="notification-email">Notification Email</Label>
              <div class="relative">
                <Mail class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="notification-email" v-model="notificationForm.notification_email" type="email" class="pl-9" placeholder="you@example.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div class="flex justify-end">
          <Button :disabled="savingNotifications" @click="saveNotifications">
            <Save class="size-4 mr-2" />
            {{ savingNotifications ? 'Saving…' : 'Save Notification Settings' }}
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>