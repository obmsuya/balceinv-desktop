<template>
  <div class="splash" :class="{ dark: isDark }">
    <!-- Animated background grid -->
    <div class="grid-bg" />
    <!-- Floating orbs -->
    <div class="orb orb-1" />
    <div class="orb orb-2" />
    <div class="orb orb-3" />

    <div class="content" :class="{ visible: show }">
      <!-- Logo mark -->
      <div class="logo-mark">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="24" height="24" rx="6" class="sq sq-1"/>
          <rect x="36" y="4" width="24" height="24" rx="6" class="sq sq-2"/>
          <rect x="4" y="36" width="24" height="24" rx="6" class="sq sq-3"/>
          <rect x="36" y="36" width="24" height="24" rx="6" class="sq sq-4"/>
        </svg>
      </div>

      <!-- Brand name -->
      <div class="brand">
        <span class="brand-pos">POS</span>
        <span class="brand-sep">&</span>
        <span class="brand-inv">INVENTORY</span>
      </div>

      <p class="tagline">Smart. Fast. Always in control.</p>

      <!-- Progress bar -->
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progress + '%' }" />
      </div>

      <p class="loading-text">{{ loadingText }}</p>
    </div>

    <!-- Version badge -->
    <div class="version-badge" :class="{ visible: show }">v2.0</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const show = ref(false)
const progress = ref(0)
const isDark = ref(false)

const steps = ['Initializing system...', 'Loading inventory...', 'Almost ready...']
const loadingText = ref(steps[0])

onMounted(async () => {
  // Detect color scheme
  isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches

  // Play a soft click/chime sound
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const playTone = (freq: number, start: number, dur: number, gain = 0.15) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gainNode.gain.setValueAtTime(0, ctx.currentTime + start)
      gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }
    // Short ascending chime
    playTone(523, 0.1, 0.4)   // C5
    playTone(659, 0.3, 0.4)   // E5
    playTone(784, 0.5, 0.6)   // G5
  } catch {}

  setTimeout(() => { show.value = true }, 100)

  // Animate progress
  let step = 0
  const interval = setInterval(() => {
    progress.value += Math.random() * 18 + 8
    if (progress.value >= 40 && step === 0) { step = 1; loadingText.value = steps[1] }
    if (progress.value >= 75 && step === 1) { step = 2; loadingText.value = steps[2] }
    if (progress.value >= 100) {
      progress.value = 100
      clearInterval(interval)
    }
  }, 350)

    setTimeout(async () => {
    const { checkSetup } = useAuth()
    const configured = await checkSetup()
    await navigateTo(configured ? '/login' : '/setup')
  }, 3200)
})
</script>

<style scoped>
/* ── Base ────────────────────────────────────────── */
.splash {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fb;
  overflow: hidden;
  position: relative;
  font-family: 'Segoe UI', system-ui, sans-serif;
  transition: background 0.3s;
}
.splash.dark {
  background: #0b0f1a;
}

/* ── Grid background ─────────────────────────────── */
.grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99,153,34,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,153,34,0.07) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
}
.dark .grid-bg {
  background-image:
    linear-gradient(rgba(99,200,80,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,200,80,0.07) 1px, transparent 1px);
}

/* ── Floating orbs ───────────────────────────────── */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
  animation: drift 8s ease-in-out infinite;
}
.orb-1 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, #a8d470 0%, transparent 70%);
  top: -100px; left: -100px;
  animation-delay: 0s;
}
.orb-2 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, #4ade80 0%, transparent 70%);
  bottom: -80px; right: -80px;
  animation-delay: -3s;
}
.orb-3 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, #86efac 0%, transparent 70%);
  top: 50%; left: 60%;
  animation-delay: -5s;
}
.dark .orb { opacity: 0.18; }

@keyframes drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(20px, -30px) scale(1.05); }
  66% { transform: translate(-15px, 20px) scale(0.97); }
}

/* ── Content wrapper ─────────────────────────────── */
.content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1);
}
.content.visible { opacity: 1; transform: translateY(0); }

/* ── Logo mark ───────────────────────────────────── */
.logo-mark {
  width: 72px;
  height: 72px;
  margin-bottom: 28px;
}
.logo-mark svg { width: 100%; height: 100%; }

.sq {
  transition: opacity 0.3s;
}
.sq-1 { fill: #639922; }
.sq-2 { fill: #4a7a18; opacity: 0.75; animation: sq-pulse 2.4s ease-in-out infinite; }
.sq-3 { fill: #4a7a18; opacity: 0.75; animation: sq-pulse 2.4s ease-in-out infinite 0.6s; }
.sq-4 { fill: #2d5a10; opacity: 0.55; animation: sq-pulse 2.4s ease-in-out infinite 1.2s; }

.dark .sq-1 { fill: #7bc83a; }
.dark .sq-2 { fill: #63a82e; }
.dark .sq-3 { fill: #63a82e; }
.dark .sq-4 { fill: #4a8022; }

@keyframes sq-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

/* ── Brand text ──────────────────────────────────── */
.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
  letter-spacing: 0.04em;
}
.brand-pos {
  font-size: 3.2rem;
  font-weight: 800;
  color: #1a2e0a;
  letter-spacing: 0.12em;
}
.brand-sep {
  font-size: 1.8rem;
  font-weight: 300;
  color: #639922;
}
.brand-inv {
  font-size: 1.6rem;
  font-weight: 700;
  color: #3a5c14;
  letter-spacing: 0.14em;
}
.dark .brand-pos { color: #e8f5d4; }
.dark .brand-sep { color: #7bc83a; }
.dark .brand-inv { color: #a8d470; }

/* ── Tagline ─────────────────────────────────────── */
.tagline {
  font-size: 0.875rem;
  color: #6b7a5e;
  letter-spacing: 0.08em;
  margin: 0 0 32px;
  text-transform: uppercase;
}
.dark .tagline { color: #8aab6a; }

/* ── Progress bar ────────────────────────────────── */
.progress-track {
  width: 220px;
  height: 3px;
  background: rgba(99,153,34,0.15);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 12px;
}
.dark .progress-track { background: rgba(123,200,58,0.12); }

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #639922, #86c940);
  border-radius: 99px;
  transition: width 0.35s ease;
}
.dark .progress-fill { background: linear-gradient(90deg, #7bc83a, #a8d470); }

/* ── Loading text ────────────────────────────────── */
.loading-text {
  font-size: 0.75rem;
  color: #9aaa88;
  letter-spacing: 0.06em;
  margin: 0;
  min-height: 1em;
  transition: opacity 0.3s;
}
.dark .loading-text { color: #6a8a52; }

/* ── Version badge ───────────────────────────────── */
.version-badge {
  position: fixed;
  bottom: 24px;
  right: 24px;
  font-size: 0.7rem;
  color: #c0cdb0;
  letter-spacing: 0.1em;
  opacity: 0;
  transition: opacity 1.2s 0.8s;
}
.version-badge.visible { opacity: 1; }
.dark .version-badge { color: #4a6035; }
</style>