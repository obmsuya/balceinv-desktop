<!-- layouts/default.vue -->
<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    
    <div class="flex flex-1 pt-16">
      <CustomSidebar />
      
      <main 
        :class="[
          'flex-1 p-6 transition-all duration-200',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        ]"
      >
        <slot />
      </main>
      <Toaster />
    </div>
    
    <AppFooter />
  </div>
</template>

<script setup>
// Get shared sidebar state
const sidebarCollapsed = useState('sidebar-collapsed', () => false)

import 'vue-sonner/style.css'
import { Toaster } from '@/components/ui/sonner'
definePageMeta({
  middleware: 'permissions'
})
</script>