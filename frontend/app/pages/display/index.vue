<script setup lang="ts">
definePageMeta({ layout: false })

// ── Types ─────────────────────────────────────────────────────────────────

interface DisplayItem {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface DisplayData {
  items: DisplayItem[]
  total: number
  updatedAt: number
}

// ── State ─────────────────────────────────────────────────────────────────

const displayData = ref<DisplayData | null>(null)
const isConnected = ref(false)
const lastUpdated = ref(0)
const currentTime = ref('')

// ── Poll localStorage written by the POS page ─────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null
let clockInterval: ReturnType<typeof setInterval> | null = null

const readDisplayData = () => {
  if (!import.meta.client) return

  const raw = localStorage.getItem('pos-display-data')
  if (!raw) {
    isConnected.value = false
    return
  }

  try {
    const parsed: DisplayData = JSON.parse(raw)

    const dataAge = Date.now() - parsed.updatedAt
    if (dataAge > 60_000) {
      isConnected.value = false
      return
    }

    displayData.value = parsed
    lastUpdated.value = parsed.updatedAt
    isConnected.value = true
  } catch {
    isConnected.value = false
  }
}

const updateClock = () => {
  currentTime.value = new Intl.DateTimeFormat('en-TZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

onMounted(() => {
  updateClock()
  readDisplayData()

  pollInterval = setInterval(readDisplayData, 800)
  clockInterval = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (clockInterval) clearInterval(clockInterval)
})

// ── Formatting ────────────────────────────────────────────────────────────

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(value)

const currentDate = computed(() =>
  new Intl.DateTimeFormat('en-TZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date()),
)

const hasItems = computed(
  () => displayData.value && displayData.value.items.length > 0,
)

const totalItemCount = computed(() => {
  if (!displayData.value) return 0
  return displayData.value.items.reduce((sum, item) => sum + item.quantity, 0)
})
</script>

<template>
  <div class="display-root">

    <!-- ── Top bar ──────────────────────────────────────────────────────── -->
    <header class="display-header">
      <div class="header-brand">
        <div class="brand-squares" aria-hidden="true">
          <i class="sq sq-1" />
          <i class="sq sq-2" />
          <i class="sq sq-3" />
          <i class="sq sq-4" />
        </div>
        <span class="brand-name">BALCE</span>
      </div>

      <div class="header-center">
        <p class="header-date">{{ currentDate }}</p>
      </div>

      <div class="header-right">
        <div class="connection-dot" :class="isConnected ? 'connected' : 'disconnected'" />
        <span class="header-time">{{ currentTime }}</span>
      </div>
    </header>

    <!-- ── Main content ─────────────────────────────────────────────────── -->
    <main class="display-main">

      <!-- Idle state — no items in cart -->
      <div v-if="!hasItems" class="idle-screen">
        <div class="idle-squares" aria-hidden="true">
          <div class="idle-sq idle-sq-1" />
          <div class="idle-sq idle-sq-2" />
          <div class="idle-sq idle-sq-3" />
          <div class="idle-sq idle-sq-4" />
        </div>
        <p class="idle-welcome">Welcome</p>
        <p class="idle-sub">Please wait while your items are being scanned</p>
      </div>

      <!-- Active cart -->
      <div v-else class="cart-screen">

        <!-- Items list -->
        <div class="items-panel">
          <div class="items-header">
            <span>Item</span>
            <span>Qty</span>
            <span>Price</span>
            <span class="text-right">Total</span>
          </div>

          <div class="items-scroll">
            <div
              v-for="(item, index) in displayData!.items"
              :key="index"
              class="item-row"
              :class="index % 2 === 0 ? 'item-row-even' : 'item-row-odd'"
            >
              <span class="item-name">{{ item.name }}</span>
              <span class="item-qty">{{ item.quantity }}</span>
              <span class="item-price">{{ formatCurrency(item.unitPrice) }}</span>
              <span class="item-total">{{ formatCurrency(item.lineTotal) }}</span>
            </div>
          </div>

          <div class="items-count">
            {{ totalItemCount }} item{{ totalItemCount !== 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Total panel -->
        <div class="total-panel">
          <p class="total-label">Total Amount</p>
          <p class="total-amount">{{ formatCurrency(displayData!.total) }}</p>
          <p class="total-tax-note">* Includes VAT</p>
        </div>

      </div>
    </main>

    <!-- ── Footer ───────────────────────────────────────────────────────── -->
    <footer class="display-footer">
      <p>Thank you for shopping with us</p>
    </footer>

  </div>
</template>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────────────── */
.display-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  color: #ffffff;
  font-family: 'Segoe UI', system-ui, sans-serif;
  overflow: hidden;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.display-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-squares {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  width: 22px;
  height: 22px;
}

.brand-squares i {
  display: block;
  border-radius: 3px;
  font-style: normal;
}

.sq-1 { background: #7bc83a; }
.sq-2 { background: #5fa028; opacity: 0.8; }
.sq-3 { background: #5fa028; opacity: 0.8; }
.sq-4 { background: #3e7018; opacity: 0.45; }

.brand-name {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.88);
}

.header-center {
  text-align: center;
}

.header-date {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.connection-dot.connected {
  background: #7bc83a;
  box-shadow: 0 0 8px rgba(123, 200, 58, 0.6);
  animation: pulse-dot 2s ease-in-out infinite;
}

.connection-dot.disconnected {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.header-time {
  font-size: 1.1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.88);
  letter-spacing: 0.05em;
}

/* ── Main ──────────────────────────────────────────────────────────────── */
.display-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Idle screen ───────────────────────────────────────────────────────── */
.idle-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  position: relative;
}

.idle-squares {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100px;
  height: 100px;
  margin-bottom: 1rem;
  animation: idle-breathe 3s ease-in-out infinite;
}

@keyframes idle-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

.idle-sq {
  border-radius: 12px;
}

.idle-sq-1 { background: #7bc83a; }
.idle-sq-2 { background: #5fa028; opacity: 0.8; }
.idle-sq-3 { background: #5fa028; opacity: 0.8; }
.idle-sq-4 { background: #3e7018; opacity: 0.45; }

.idle-welcome {
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin: 0;
}

.idle-sub {
  font-size: clamp(0.9rem, 2vw, 1.2rem);
  color: rgba(255, 255, 255, 0.35);
  margin: 0;
  text-align: center;
  max-width: 480px;
}

/* ── Cart screen ───────────────────────────────────────────────────────── */
.cart-screen {
  flex: 1;
  display: flex;
  gap: 0;
}

/* ── Items panel ───────────────────────────────────────────────────────── */
.items-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.items-header {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 1rem;
  padding: 0.9rem 2rem;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.items-header span:nth-child(2),
.items-header span:nth-child(3),
.items-header span:nth-child(4) {
  min-width: 90px;
  text-align: right;
}

.items-scroll {
  flex: 1;
  overflow-y: auto;
}

.items-scroll::-webkit-scrollbar {
  width: 4px;
}

.items-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.items-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.item-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 1rem;
  padding: 1rem 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  animation: row-enter 0.2s ease;
}

@keyframes row-enter {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}

.item-row-even { background: transparent; }
.item-row-odd  { background: rgba(255, 255, 255, 0.02); }

.item-name {
  font-size: clamp(0.95rem, 2vw, 1.15rem);
  font-weight: 500;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-qty,
.item-price,
.item-total {
  font-size: clamp(0.9rem, 1.8vw, 1.1rem);
  font-variant-numeric: tabular-nums;
  min-width: 90px;
  text-align: right;
}

.item-qty    { color: rgba(255, 255, 255, 0.55); }
.item-price  { color: rgba(255, 255, 255, 0.7); }
.item-total  { color: #ffffff; font-weight: 600; }

.items-count {
  padding: 0.6rem 2rem;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  letter-spacing: 0.04em;
}

/* ── Total panel ───────────────────────────────────────────────────────── */
.total-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 2rem;
  background: #161b22;
}

.total-label {
  font-size: 1rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.total-amount {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  color: #7bc83a;
  margin: 0;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  text-align: center;
  word-break: break-all;
}

.total-tax-note {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.2);
  margin: 0.5rem 0 0;
}

/* ── Footer ────────────────────────────────────────────────────────────── */
.display-footer {
  padding: 0.65rem 2rem;
  text-align: center;
  background: #161b22;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
</style>