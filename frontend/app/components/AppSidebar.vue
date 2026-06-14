<template>
  <Sidebar variant="sidebar" collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <a href="/">
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Store class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">Business Name</span>
                <span class="truncate text-xs">POS & Inventory</span>
              </div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Operations</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in operationItems" :key="item.title">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Inventory</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in inventoryItems" :key="item.title">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Analytics</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in analyticsItems" :key="item.title">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Administration</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in adminItems" :key="item.title">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton size="lg">
                <Avatar class="h-8 w-8 rounded-lg">
                  <AvatarFallback class="rounded-lg">CU</AvatarFallback>
                </Avatar>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">Current User</span>
                  <span class="truncate text-xs">user@example.com</span>
                </div>
                <ChevronUp class="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side="bottom" align="end" :side-offset="4">
              <DropdownMenuLabel class="p-0 font-normal">
                <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar class="h-8 w-8 rounded-lg">
                    <AvatarFallback class="rounded-lg">CU</AvatarFallback>
                  </Avatar>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">Current User</span>
                    <span class="truncate text-xs">user@example.com</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
    
    <SidebarRail />
  </Sidebar>
</template>

<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import '@/assets/css/main.css'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

import {
  Store,
  CreditCard,
  ShoppingCart,
  Package,
  Boxes,
  Tag,
  Truck,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  Shield,
  Settings,
  User,
  LogOut,
  ChevronUp,
} from 'lucide-vue-next'

const operationItems = [
  { title: 'Point of Sale', url: '/pos', icon: CreditCard },
  { title: 'Sales History', url: '/sales', icon: ShoppingCart },
  { title: 'Products', url: '/products', icon: Package },
]

const inventoryItems = [
  { title: 'Stock Management', url: '/inventory', icon: Boxes },
  { title: 'Categories', url: '/inventory/categories', icon: Tag },
  { title: 'Suppliers', url: '/inventory/suppliers', icon: Truck },
  { title: 'Low Stock Alerts', url: '/inventory/low-stock', icon: AlertTriangle },
]

const analyticsItems = [
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Sales Reports', url: '/reports/sales', icon: TrendingUp },
  { title: 'Inventory Reports', url: '/reports/inventory', icon: PieChart },
]

const adminItems = [
  { title: 'User Management', url: '/admin/users', icon: Users },
  { title: 'Roles & Permissions', url: '/admin/roles', icon: Shield },
  { title: 'System Settings', url: '/admin/settings', icon: Settings },
]
</script>