<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
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

definePageMeta({ layout: false })

const formSchema = toTypedSchema(z.object({
  name: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'At least 6 characters')
}))

const { setupAdmin, isLoading } = useAuth()
const form = useForm({ validationSchema: formSchema })
const mounted = ref(false)

onMounted(() => setTimeout(() => { mounted.value = true }, 60))

const onSubmit = form.handleSubmit(async (values) => {
  try {
    const response = await setupAdmin(values)
    if (response.success) {
      toast.success('Super User created', { description: 'Admin account set up successfully' })
      await navigateTo('/login')
    }
  } catch (error: any) {
    toast.error('Setup failed', { description: error.data?.message || 'Error connecting to server' })
  }
})
</script>

<template>
  <div class="root">
    <!-- Left dark panel -->
    <aside class="panel" :class="{ show: mounted }">
      <div class="panel-content">
        <div class="wordmark">
          <div class="squares">
            <i class="s1"/><i class="s2"/>
            <i class="s3"/><i class="s4"/>
          </div>
          <span>BALCE</span>
        </div>

        <div class="pitch">
          <h1>One setup.<br>Total control.</h1>
          <p>The Super User account owns everything — users, roles, permissions, and system settings. Set it up once.</p>
        </div>

        <div class="steps">
          <div class="step">
            <span class="n">01</span>
            <div>
              <strong>Create this account</strong>
              <p>Unrestricted access to all modules</p>
            </div>
          </div>
          <div class="step">
            <span class="n">02</span>
            <div>
              <strong>Configure roles</strong>
              <p>Define what each team member can do</p>
            </div>
          </div>
          <div class="step">
            <span class="n">03</span>
            <div>
              <strong>Start operating</strong>
              <p>Add products, sell, and track stock</p>
            </div>
          </div>
        </div>
      </div>

      <p class="panel-foot">&copy; {{ new Date().getFullYear() }} BALCE · POS &amp; Inventory</p>

      <div class="rings" aria-hidden="true">
        <div/><div/><div/>
      </div>
    </aside>

    <!-- Right form panel -->
    <main class="form-side" :class="{ show: mounted }">
      <div class="form-box">
        <div class="form-head">
          <div class="badge">Initial Setup</div>
          <h2>Create Super User</h2>
          <p>This account has full, unrestricted system access.</p>
        </div>

        <form @submit="onSubmit" class="fields">
          <FormField v-slot="{ componentField }" name="name">
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Admin Name"
                  autocomplete="name"
                  :disabled="isLoading"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="admin@company.com"
                  autocomplete="email"
                  :disabled="isLoading"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <FormLabel>Root password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Minimum 6 characters"
                  autocomplete="new-password"
                  :disabled="isLoading"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button as-child>
            <button type="submit" class="w-full h-11" :disabled="isLoading">
              <span v-if="isLoading" class="spin"/>
              {{ isLoading ? 'Creating account…' : 'Create account' }}
            </button>
          </Button>
        </form>

        <div class="or-row">
          <span/><em>already set up?</em><span/>
        </div>

        <NuxtLink to="/login" class="ghost-btn">
          Sign in instead
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ── Root ── safe layout, no overflow traps */
.root {
  min-height: 100vh;
  display: flex;
}

/* ── Left panel ── */
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

/* Wordmark */
.wordmark { display: flex; align-items: center; gap: 10px; }
.wordmark span {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: rgba(255,255,255,0.88);
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

/* Pitch */
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
  color: rgba(255,255,255,0.38);
  margin: 0;
  max-width: 300px;
}

/* Steps */
.steps { display: flex; flex-direction: column; gap: 1.35rem; }
.step { display: flex; align-items: flex-start; gap: 1rem; }
.n {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #7bc83a;
  opacity: 0.65;
  padding-top: 2px;
  min-width: 20px;
}
.step strong {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(255,255,255,0.78);
  margin-bottom: 2px;
}
.step p {
  font-size: 0.73rem;
  color: rgba(255,255,255,0.28);
  margin: 0;
  line-height: 1.5;
}

/* Footer */
.panel-foot {
  position: absolute;
  bottom: 2rem;
  left: 3.5rem;
  font-size: 0.68rem;
  color: rgba(255,255,255,0.18);
  z-index: 2;
  margin: 0;
  letter-spacing: 0.02em;
}

/* Rings */
.rings { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.rings div {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(123,200,58,0.06);
}
.rings div:nth-child(1) { width: 600px; height: 600px; bottom: -280px; right: -220px; }
.rings div:nth-child(2) { width: 400px; height: 400px; bottom: -170px; right: -130px; }
.rings div:nth-child(3) { width: 230px; height: 230px; bottom: -80px; right: -55px; border-color: rgba(123,200,58,0.1); }

/* ── Right form side ── */
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

/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 0.67rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.08);
  border: 1px solid hsl(var(--primary) / 0.18);
  margin-bottom: 0.7rem;
}

.form-head { margin-bottom: 2rem; }
.form-head h2 {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: hsl(var(--foreground));
  margin: 0 0 0.3rem;
}
.form-head p {
  font-size: 0.84rem;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

.fields { display: flex; flex-direction: column; gap: 1.1rem; }

.or-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0 1rem;
}
.or-row span { flex: 1; height: 1px; background: hsl(var(--border)); }
.or-row em {
  font-size: 0.72rem;
  font-style: normal;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.ghost-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  border-radius: calc(var(--radius) - 2px);
  border: 1px solid hsl(var(--border));
  font-size: 0.84rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  text-decoration: none;
  transition: background 0.15s;
}
.ghost-btn:hover { background: hsl(var(--accent)); }

.spin {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: rot 0.5s linear infinite;
  margin-right: 7px;
  vertical-align: middle;
}
@keyframes rot { to { transform: rotate(360deg); } }

@media (max-width: 840px) {
  .panel { display: none; }
  .form-side { padding: 2rem 1.5rem; }
}
</style>