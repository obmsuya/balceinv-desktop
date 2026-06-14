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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

definePageMeta({ layout: false })

const { setup, checkSetup, isLoading } = useAuth()

const mounted = ref(false)
const step = ref<1 | 2>(1)

const businessTypes = [
  { value: 'pharmacy',    label: 'Pharmacy' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'retail',      label: 'Retail Store' },
  { value: 'hardware',    label: 'Hardware Store' },
  { value: 'wholesale',   label: 'Wholesaler' },
  { value: 'winehouse',   label: 'Wine & Spirits' },
  { value: 'beauty',      label: 'Beauty & Cosmetics' },
]

const formSchema = toTypedSchema(z.object({
  business_name:  z.string().min(2, 'Business name is required'),
  business_type:  z.string().min(1, 'Please select a business type'),
  phone:          z.string().optional(),
  address:        z.string().optional(),
  tin:            z.string().optional(),
  owner_name:     z.string().min(2, 'Your name is required'),
  owner_email:    z.string().min(1, 'Email is required').email('Enter a valid email'),
  owner_password: z.string().min(6, 'Password must be at least 6 characters'),
}))

const form = useForm({ validationSchema: formSchema })

onMounted(async () => {
  const route = useRoute()
  const comingFromLogin = route.query.from === 'login'

  if (!comingFromLogin) {
    const configured = await checkSetup()
    if (configured) {
      await navigateTo('/login')
      return
    }
  }

  setTimeout(() => { mounted.value = true }, 60)
})

const nextStep = async () => {
  const nameValid = await form.validateField('business_name')
  const typeValid = await form.validateField('business_type')
  if (nameValid.valid && typeValid.valid) {
    step.value = 2
  }
}

const onSubmit = form.handleSubmit(async (values) => {
  try {
    await setup(values)
    toast.success('Business account created!', {
      description: 'You can now sign in with your credentials.'
    })
    await navigateTo('/login')
  } catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Something went wrong'
    toast.error('Setup failed', { description: msg })
  }
})
</script>

<template>
  <div class="root">
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
          <h1>Set up your<br>business in minutes.</h1>
          <p>Tell us about your store and create your owner account. This only happens once.</p>
        </div>

        <div class="steps-strip">
          <div class="step-item" :class="{ active: step === 1, done: step === 2 }">
            <div class="step-dot">
              <svg v-if="step === 2" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span v-else>1</span>
            </div>
            <div class="step-text">
              <strong>Business info</strong>
              <span>Name, type &amp; location</span>
            </div>
          </div>
          <div class="step-line" :class="{ done: step === 2 }"/>
          <div class="step-item" :class="{ active: step === 2 }">
            <div class="step-dot"><span>2</span></div>
            <div class="step-text">
              <strong>Owner account</strong>
              <span>Your login credentials</span>
            </div>
          </div>
        </div>
      </div>

      <p class="panel-foot">&copy; {{ new Date().getFullYear() }} BALCE · POS &amp; Inventory</p>

      <div class="rings" aria-hidden="true">
        <div/><div/><div/>
      </div>
    </aside>

    <main class="form-side" :class="{ show: mounted }">
      <div class="form-box">

        <div v-show="step === 1">
          <div class="form-head">
            <h2>Your business</h2>
            <p>Start with the basics — you can update everything later in settings.</p>
          </div>

          <div class="fields">
            <FormField v-slot="{ componentField }" name="business_name">
              <FormItem>
                <FormLabel>Business name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Duka la Amina" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="business_type">
              <FormItem>
                <FormLabel>Business type</FormLabel>
                <FormControl>
                  <Select v-bind="componentField">
                    <SelectTrigger>
                      <SelectValue placeholder="Select your business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem
                          v-for="bt in businessTypes"
                          :key="bt.value"
                          :value="bt.value"
                        >
                          {{ bt.label }}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="phone">
              <FormItem>
                <FormLabel>Phone <span class="optional">(optional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="+255 7xx xxx xxx" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="address">
              <FormItem>
                <FormLabel>Address <span class="optional">(optional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="Street, area, city" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="tin">
              <FormItem>
                <FormLabel>TIN number <span class="optional">(optional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="Tax Identification Number" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <Button class="w-full h-11" @click="nextStep">
              Continue to owner account
            </Button>
          </div>
        </div>

        <div v-show="step === 2">
          <div class="form-head">
            <h2>Owner account</h2>
            <p>This will be the main admin account for your business.</p>
          </div>

          <form class="fields" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="owner_name">
              <FormItem>
                <FormLabel>Your full name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Amina Juma"
                    :disabled="isLoading"
                    v-bind="componentField"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="owner_email">
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                    :disabled="isLoading"
                    v-bind="componentField"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="owner_password">
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
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
                {{ isLoading ? 'Creating account...' : 'Create business account' }}
              </button>
            </Button>

            <button type="button" class="back-btn" :disabled="isLoading" @click="step = 1">
              ← Back to business info
            </button>
          </form>
        </div>

        <div class="login-row">
          Already have an account?
          <NuxtLink to="/login" class="ghost-link">Sign in</NuxtLink>
        </div>
      </div>
    </main>
  </div>
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

.steps-strip {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1.25rem 1.35rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255,255,255,0.3);
  transition: all 0.25s ease;
}
.step-dot svg { width: 14px; height: 14px; }
.step-item.active .step-dot {
  background: #7bc83a;
  border-color: #7bc83a;
  color: #fff;
}
.step-item.done .step-dot {
  background: rgba(123,200,58,0.2);
  border-color: #7bc83a;
  color: #7bc83a;
}

.step-text { display: flex; flex-direction: column; gap: 2px; }
.step-text strong {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
}
.step-item:not(.active):not(.done) .step-text strong { color: rgba(255,255,255,0.35); }
.step-text span { font-size: 0.7rem; color: rgba(255,255,255,0.25); }

.step-line {
  width: 1px;
  height: 20px;
  background: rgba(255,255,255,0.08);
  margin: 4px 0 4px 13px;
  transition: background 0.25s ease;
}
.step-line.done { background: rgba(123,200,58,0.3); }

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

.rings { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.rings div {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(123,200,58,0.06);
}
.rings div:nth-child(1) { width: 600px; height: 600px; bottom: -280px; right: -220px; }
.rings div:nth-child(2) { width: 400px; height: 400px; bottom: -170px; right: -130px; }
.rings div:nth-child(3) { width: 230px; height: 230px; bottom: -80px; right: -55px; border-color: rgba(123,200,58,0.1); }

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
  overflow-y: auto;
}
.form-side.show { opacity: 1; transform: translateX(0); }

.form-box {
  width: 100%;
  max-width: 340px;
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

.fields {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.optional {
  font-size: 0.72rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.back-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  text-align: left;
  transition: color 0.15s;
}
.back-btn:hover { color: hsl(var(--foreground)); }
.back-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.login-row {
  margin-top: 1.75rem;
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.ghost-link {
  font-size: 0.82rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  text-decoration: none;
  transition: opacity 0.15s;
}
.ghost-link:hover { opacity: 0.7; }

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-enter-from { opacity: 0; transform: translateX(16px); }
.slide-leave-to   { opacity: 0; transform: translateX(-16px); }

@media (max-width: 840px) {
  .panel { display: none; }
  .form-side { padding: 2rem 1.5rem; }
}
</style>