<!-- AppFooter.vue -->
<template>
  <footer class="border-t bg-background mt-auto">
    <div class="container mx-auto px-4 py-6">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <p class="text-sm text-muted-foreground">
          © {{ currentYear }} Business Name. All rights reserved.
        </p>
        
        <div class="flex items-center gap-4 text-sm">
          <a href="#" class="text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </a>
          <span class="text-muted-foreground">•</span>
          <a href="#" class="text-muted-foreground hover:text-foreground transition-colors">
            Terms of Service
          </a>
          <span class="text-muted-foreground">•</span>
          <a href="#" class="text-muted-foreground hover:text-foreground transition-colors">
            Support
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
</script>

