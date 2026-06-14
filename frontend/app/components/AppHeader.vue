<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Menu, Bell, Volume2, VolumeX } from 'lucide-vue-next';
import { Icon } from '@iconify/vue';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// Color mode
const colorMode = useColorMode();

// Import notification composable
const {
  notificationCount,
  unreadNotifications,
  hasUnread,
  soundEnabled,
  fetchNotificationCount,
  markAsSeen,
  toggleSound,
  loadSoundSetting,
} = useNotifications();

const sidebarCollapsed = useState('sidebar-collapsed', () => false);

const user = ref<{
  name: string;
  email: string;
  role: string;
} | null>(null);

const showNotificationPopover = ref(false);
const notificationInterval = ref<NodeJS.Timeout | null>(null);

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  if (process.client) {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed.value.toString());
  }
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const handleLogout = async () => {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' });
    if (process.client) {
      localStorage.removeItem('user');
    }
    await navigateTo('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};

/**
 * Format notification time
 */
const formatNotificationTime = (date: Date): string => {
  const now = new Date();
  const notifDate = new Date(date);
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return notifDate.toLocaleDateString();
};

/**
 * Get notification message
 */
const getNotificationMessage = (notification: any): string => {
  if (notification.alertType === 'out') {
    return `${notification.productName} is out of stock`;
  }
  return `${notification.productName} is low (${notification.currentQuantity} left)`;
};

/**
 * Handle notification click
 */
const handleNotificationClick = async (notification: any) => {
  await markAsSeen(notification.id);
  showNotificationPopover.value = false;
  navigateTo(`/products/${notification.productId}`);
};

/**
 * View all notifications
 */
const viewAllNotifications = () => {
  showNotificationPopover.value = false;
  navigateTo('/notifications');
};

/**
 * Setup notification polling
 */
const setupNotificationPolling = () => {
  // Check for new notifications every 30 seconds
  notificationInterval.value = setInterval(() => {
    fetchNotificationCount();
  }, 30000);
};

/**
 * Clear notification polling
 */
const clearNotificationPolling = () => {
  if (notificationInterval.value) {
    clearInterval(notificationInterval.value);
    notificationInterval.value = null;
  }
};

onMounted(() => {
  if (process.client) {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState !== null) {
      sidebarCollapsed.value = savedState === 'true';
    }

    // Load notification settings and start polling
    loadSoundSetting();
    fetchNotificationCount();
    setupNotificationPolling();
  }
});

onUnmounted(() => {
  clearNotificationPolling();
});
</script>

<template>
  <header class="fixed top-0 left-0 right-0 h-16 border-b bg-background z-50">
    <div class="flex items-center justify-between h-full px-4 gap-4">
      <div class="flex items-center gap-3">
        <button 
          @click="toggleSidebar"
          class="flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors shrink-0"
        >
          <Menu class="h-5 w-5" />
        </button>
        
        <h1 class="text-lg font-semibold hidden sm:block">POS System</h1>
      </div>

      <div class="flex items-center gap-2">
        <!-- Mode Toggle -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon">
              <Icon icon="radix-icons:moon" class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Icon icon="radix-icons:sun" class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span class="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="colorMode.preference = 'light'">
              Light
            </DropdownMenuItem>
            <DropdownMenuItem @click="colorMode.preference = 'dark'">
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem @click="colorMode.preference = 'system'">
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Sound Toggle -->
        <Button
          variant="ghost"
          size="icon"
          @click="toggleSound"
          :title="soundEnabled ? 'Mute notifications' : 'Unmute notifications'"
          class="hidden sm:flex"
        >
          <Volume2 v-if="soundEnabled" class="h-5 w-5" />
          <VolumeX v-else class="h-5 w-5" />
        </Button>

        <!-- Notifications Popover -->
        <Popover v-model:open="showNotificationPopover">
          <PopoverTrigger as-child>
            <Button 
              variant="ghost"
              size="icon"
              class="relative"
            >
              <Bell class="h-5 w-5" />
              <Badge 
                v-if="hasUnread" 
                class="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center p-0 px-1 text-xs"
                variant="destructive"
              >
                {{ notificationCount > 99 ? '99+' : notificationCount }}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80 p-0" align="end">
            <div class="flex items-center justify-between p-4">
              <h4 class="font-semibold">Notifications</h4>
              <Badge v-if="hasUnread" variant="secondary">
                {{ notificationCount }} new
              </Badge>
            </div>
            <Separator />
            
            <!-- Notification List -->
            <ScrollArea class="h-[400px]">
              <div v-if="unreadNotifications.length === 0" class="p-8 text-center">
                <Bell class="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p class="text-sm text-muted-foreground">No new notifications</p>
              </div>

              <div v-else class="divide-y">
                <button
                  v-for="notification in unreadNotifications.slice(0, 5)"
                  :key="notification.id"
                  @click="handleNotificationClick(notification)"
                  class="w-full p-4 text-left hover:bg-accent transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <div 
                      class="rounded-full p-2 shrink-0 mt-1"
                      :class="notification.alertType === 'out' ? 'bg-destructive/10' : 'bg-yellow-500/10'"
                    >
                      <Bell 
                        class="h-4 w-4" 
                        :class="notification.alertType === 'out' ? 'text-destructive' : 'text-yellow-600'"
                      />
                    </div>
                    
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium mb-1 line-clamp-2">
                        {{ getNotificationMessage(notification) }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ formatNotificationTime(notification.createdAt) }}
                      </p>
                    </div>

                    <Badge 
                      variant="outline"
                      class="shrink-0"
                      :class="notification.alertType === 'out' ? 'border-destructive text-destructive' : 'border-yellow-600 text-yellow-600'"
                    >
                      {{ notification.alertType === 'out' ? 'Out' : 'Low' }}
                    </Badge>
                  </div>
                </button>
              </div>
            </ScrollArea>

            <Separator />
            <div class="p-2">
              <Button
                variant="ghost"
                class="w-full justify-center"
                @click="viewAllNotifications"
              >
                View All Notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        
        <!-- User Menu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="flex items-center gap-2 pl-3 border-l hover:bg-accent rounded-md px-2 py-1 transition-colors">
              <Avatar class="h-9 w-9">
                <AvatarFallback>{{ user ? getInitials(user.name) : 'GU' }}</AvatarFallback>
              </Avatar>
              <div class="hidden md:block text-sm text-left">
                <p class="font-medium leading-none">{{ user?.name || 'Guest User' }}</p>
                <p class="text-xs text-muted-foreground mt-1">{{ user?.role || 'No Role' }}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>
              <div class="flex flex-col space-y-1">
                <p class="text-sm font-medium">{{ user?.name || 'Guest User' }}</p>
                <p class="text-xs text-muted-foreground">{{ user?.email || '' }}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="$router.push('/settings')">
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem @click="$router.push('/profile')">
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="handleLogout" class="text-destructive">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>