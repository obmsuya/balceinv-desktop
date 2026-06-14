<template>
  <div class="sidebar-section">
    <div v-if="!collapsed" class="sidebar-section-label">
      <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {{ title }}
      </span>
    </div>
    <div class="sidebar-section-content">
      <NuxtLink
        v-for="item in items"
        :key="item.title"
        :to="item.url"
        class="sidebar-menu-item"
        :class="{ 'collapsed': collapsed }"
      >
        <component :is="item.icon" class="size-4" />
        <span v-if="!collapsed" class="truncate">{{ item.title }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  items: Array<{
    title: string
    url: string
    icon: any
  }>
  collapsed: boolean
}>()
</script>

<style scoped>
.sidebar-section {
  margin-bottom: 1.5rem;
}

.sidebar-section-label {
  padding: 0 0.75rem 0.5rem;
  margin-bottom: 0.25rem;
}

.sidebar-section-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  text-decoration: none;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.sidebar-menu-item:hover {
  background-color: hsl(var(--accent));
}

.sidebar-menu-item.collapsed {
  justify-content: center;
  padding: 0.75rem;
}

.sidebar-menu-item.collapsed span {
  display: none;
}

.sidebar-menu-item.router-link-active {
  background-color: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}
</style>