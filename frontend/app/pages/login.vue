<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import { Toaster } from '~/components/ui/sonner'
import { z } from 'zod'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-vue-next'

definePageMeta({ layout: 'auth' })

const formSchema = toTypedSchema(z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(6, 'At least 6 characters')
}))

const { login, isLoading } = useAuth()
const form = useForm({ validationSchema: formSchema })
const mounted = ref(false)
const showPassword = ref(false)
const devUnlocked = ref(false)

onMounted(() => {
  setTimeout(() => { mounted.value = true }, 60)

  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      devUnlocked.value = !devUnlocked.value
    }
  }
  window.addEventListener('keydown', handler)
  onUnmounted(() => window.removeEventListener('keydown', handler))
})

const onSubmit = form.handleSubmit(async (values) => {
  try {
    const response = await login(values)
    if (response.success && response.data?.user) {
      const { role, name } = response.data.user
      toast.success('Welcome back!', { description: `Signed in as ${name}` })
      await navigateTo(role === 'SuperAdmin' || role === 'Admin' ? '/pos' : '/pos')
    }
  } catch (error: any) {
    toast.error('Sign in failed', {
      description: error?.statusCode === 401
        ? 'Invalid email or password'
        : error?.data?.message || 'Something went wrong'
    })
  }
})
</script>

<template>
  <div class="root">
    <aside class="panel" :class="{ show: mounted }">
      <div class="panel-content">
        <div class="wordmark">
          <div class="squares">
            <i class="s1" /><i class="s2" />
            <i class="s3" /><i class="s4" />
          </div>
          <span>BALCE</span>
        </div>

        <div class="pitch">
          <h1>The smarter way<br>to run your store.</h1>
          <p>Inventory, sales, and reporting — unified. Built for businesses that demand clarity and speed.</p>
        </div>

        <div class="chips">
          <div class="chip">
            <strong>Real-time</strong>
            <span>Stock alerts</span>
          </div>
          <div class="chip-sep" />
          <div class="chip">
            <strong>Multi-user</strong>
            <span>Roles &amp; access</span>
          </div>
          <div class="chip-sep" />
          <div class="chip">
            <strong>Analytics</strong>
            <span>Sales reports</span>
          </div>
        </div>
      </div>

      <p class="panel-foot">&copy; {{ new Date().getFullYear() }} BALCE · POS &amp; Inventory</p>

      <div class="rings" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
    </aside>

    <main class="form-side" :class="{ show: mounted }">
      <div class="form-box">
        <div class="form-head">
          <h2>Sign in</h2>
          <p>Enter your credentials to continue</p>
        </div>

        <form @submit="onSubmit" class="fields">
          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@company.com" autocomplete="email" :disabled="isLoading"
                  v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <div class="pw-label">
                <FormLabel>Password</FormLabel>
                <NuxtLink to="/forgot-password" class="ghost-link">Forgot password?</NuxtLink>
              </div>
              <FormControl>
                <div class="relative">
                  <Input :type="showPassword ? 'text' : 'password'" placeholder="••••••••"
                    autocomplete="current-password" :disabled="isLoading" class="pr-10" v-bind="componentField" />
                  <button type="button" class="eye-btn" @click="showPassword = !showPassword"
                    :aria-label="showPassword ? 'Hide password' : 'Show password'">
                    <component :is="showPassword ? EyeOff : Eye" class="size-4" />
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button as-child>
            <button type="submit" class="w-full h-11" :disabled="isLoading">
              {{ isLoading ? 'Signing in...' : 'Sign in' }}
            </button>
          </Button>
        </form>

        <div class="bottom-links">
          <NuxtLink to="/setup?from=login" class="setup-link">
            Set up your business
          </NuxtLink>

          <Transition name="fade">
            <NuxtLink v-if="devUnlocked" to="/admin-page" class="dev-link">
              Create Super User account
            </NuxtLink>
          </Transition>
        </div>
      </div>
    </main>
  </div>
  <Toaster />
</template>

<style scoped>
.root {
  min-height: 100vh;
  display: flex;
}

.panel {
  width: 42%;
  flex-shrink: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 4rem 3.5rem;
  overflow: hidden;
  background: #0d1117;
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 0.55s ease, transform 0.55s ease;
}
.panel.show { opacity: 1; transform: translateX(0); }
:global(.dark) .panel { background: #161b22; }

.panel-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.wordmark {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wordmark span {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.88);
}

.squares {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  width: 22px;
  height: 22px;
}
.squares i { display: block; border-radius: 3px; font-style: normal; }
.s1 { background: #7bc83a; }
.s2 { background: #5fa028; opacity: .8; }
.s3 { background: #5fa028; opacity: .8; }
.s4 { background: #3e7018; opacity: .45; }

.pitch h1 {
  font-size: clamp(1.75rem, 2.5vw, 2.2rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin: 0 0 1rem;
}
.pitch p {
  font-size: 0.875rem;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.38);
  margin: 0;
  max-width: 300px;
}

.chips {
  display: flex;
  align-items: center;
  gap: 1.4rem;
  padding: 1rem 1.35rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
}
.chip { display: flex; flex-direction: column; gap: 3px; }
.chip strong { font-size: 0.8rem; font-weight: 600; color: rgba(255, 255, 255, 0.85); white-space: nowrap; }
.chip span { font-size: 0.7rem; color: rgba(255, 255, 255, 0.28); white-space: nowrap; }
.chip-sep { width: 1px; height: 28px; background: rgba(255, 255, 255, 0.08); flex-shrink: 0; }

.panel-foot {
  position: absolute;
  bottom: 2rem;
  left: 3.5rem;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.18);
  z-index: 2;
  margin: 0;
  letter-spacing: 0.02em;
}

.rings { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.rings div { position: absolute; border-radius: 50%; border: 1px solid rgba(123, 200, 58, 0.06); }
.rings div:nth-child(1) { width: 600px; height: 600px; bottom: -280px; right: -220px; }
.rings div:nth-child(2) { width: 400px; height: 400px; bottom: -170px; right: -130px; }
.rings div:nth-child(3) { width: 230px; height: 230px; bottom: -80px; right: -55px; border-color: rgba(123, 200, 58, 0.1); }

.eye-btn {
  position: absolute;
  right: 0.65rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: hsl(var(--muted-foreground));
  display: flex;
  align-items: center;
  padding: 0;
  transition: color 0.15s;
  z-index: 1;
}
.eye-btn:hover { color: hsl(var(--foreground)); }

.form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  background: hsl(var(--background));
  opacity: 0;
  transform: translateX(20px);
  transition: opacity 0.55s ease 0.1s, transform 0.55s ease 0.1s;
}
.form-side.show { opacity: 1; transform: translateX(0); }

.form-box { width: 100%; max-width: 340px; }

.form-head { margin-bottom: 2rem; }
.form-head h2 {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: hsl(var(--foreground));
  margin: 0 0 0.3rem;
}
.form-head p { font-size: 0.84rem; color: hsl(var(--muted-foreground)); margin: 0; }

.fields { display: flex; flex-direction: column; gap: 1.1rem; }

.pw-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}

.ghost-link {
  font-size: 0.74rem;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: color 0.15s;
}
.ghost-link:hover { color: hsl(var(--foreground)); }

.bottom-links {
  margin-top: 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.setup-link {
  font-size: 0.84rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  text-decoration: none;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.setup-link:hover { background: hsl(var(--accent)); }

.dev-link {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: color 0.15s;
}
.dev-link:hover { color: hsl(var(--foreground)); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 840px) {
  .panel { display: none; }
  .form-side { padding: 2rem 1.5rem; }
}
</style>