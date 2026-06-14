<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { toast } from 'vue-sonner';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Package,
  AlertTriangle,
  Volume2,
  VolumeX,
  RefreshCw,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/composables/useNotifications';


const { user } = useAuth()
const { fetchUserPermissions } = usePermissions()
const {
  notifications,
  notificationCount,
  loading,
  soundEnabled,
  unreadNotifications,
  hasUnread,
  fetchNotifications,
  markAsSeen,
  markAllAsSeen,
  deleteNotification,
  clearSeenNotifications,
  toggleSound,
  loadSoundSetting,
} = useNotifications();

const activeTab = ref('unread');
const showDeleteDialog = ref(false);
const notificationToDelete = ref<number | null>(null);
const showClearDialog = ref(false);
const autoRefreshInterval = ref<ReturnType<typeof setInterval> | null>(null);

const formatDate = (date: Date): string => {
  const now = new Date();
  const notifDate = new Date(date);
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return notifDate.toLocaleDateString();
};

const getNotificationMessage = (notification: any): string => {
  if (notification.alert_type === 'out') {
    return `${notification.product_name} is out of stock`;
  }
  return `${notification.product_name} is low on stock (${notification.current_quantity} remaining)`;
};

const handleMarkAsSeen = async (notificationId: number) => {
  try {
    await markAsSeen(notificationId);
    toast.success('Notification marked as read');
  } catch { }
};

const handleMarkAllAsSeen = async () => {
  try {
    await markAllAsSeen();
    toast.success('All notifications marked as read');
  } catch { }
};

const openDeleteDialog = (notificationId: number) => {
  notificationToDelete.value = notificationId;
  showDeleteDialog.value = true;
};

const handleDeleteNotification = async () => {
  if (notificationToDelete.value === null) return;
  try {
    await deleteNotification(notificationToDelete.value);
    toast.success('Notification deleted');
    showDeleteDialog.value = false;
    notificationToDelete.value = null;
  } catch { }
};

const handleClearSeen = async () => {
  try {
    await clearSeenNotifications();
    toast.success('Cleared all read notifications');
    showClearDialog.value = false;
  } catch { }
};

const handleRefresh = async () => {
  await fetchNotifications(activeTab.value === 'all');
};

const handleToggleSound = () => {
  toggleSound();
  toast.success(soundEnabled.value ? 'Sound enabled' : 'Sound disabled');
};

const navigateToProduct = (productId: number) => {
  navigateTo(`/products/${productId}`);
};

const setupAutoRefresh = () => {
  autoRefreshInterval.value = setInterval(() => {
    fetchNotifications(activeTab.value === 'all');
  }, 30000);
};

const clearAutoRefresh = () => {
  if (autoRefreshInterval.value) {
    clearInterval(autoRefreshInterval.value);
    autoRefreshInterval.value = null;
  }
};

onMounted(async () => {
  if (user.value) await fetchUserPermissions(user.value.id)
  loadSoundSetting()
  await fetchNotifications()
  setupAutoRefresh()
});

onUnmounted(() => {
  clearAutoRefresh();
});

watch(activeTab, async (newTab) => {
  await fetchNotifications(newTab === 'all');
});

const displayedNotifications = computed(() => {
  if (activeTab.value === 'unread') return unreadNotifications.value;
  return notifications.value;
});
</script>

<template>
  <div class="container mx-auto py-6 px-4 space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Notifications</h1>
        <p class="text-muted-foreground mt-1">
          Manage your stock alerts and system notifications
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleToggleSound">
          <Volume2 v-if="soundEnabled" class="h-4 w-4" />
          <VolumeX v-else class="h-4 w-4" />
        </Button>

        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </Button>

        <Button v-if="hasUnread" variant="outline" @click="handleMarkAllAsSeen" :disabled="loading">
          <CheckCheck class="h-4 w-4 mr-2" />
          Mark All Read
        </Button>

        <Button v-if="notifications.some((n) => n.is_seen)" variant="outline" @click="showClearDialog = true"
          :disabled="loading">
          <Trash2 class="h-4 w-4 mr-2" />
          Clear Read
        </Button>
      </div>
    </div>

    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="unread" class="relative">
          <Bell class="h-4 w-4 mr-2" />
          Unread
          <Badge v-if="notificationCount > 0" class="ml-2" variant="destructive">
            {{ notificationCount }}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="all">
          <BellOff class="h-4 w-4 mr-2" />
          All Notifications
        </TabsTrigger>
      </TabsList>

      <!-- Loading State -->
      <div v-if="loading && notifications.length === 0" class="space-y-4">
        <Card v-for="i in 3" :key="i">
          <CardHeader>
            <div class="flex items-start justify-between">
              <div class="space-y-2 flex-1">
                <Skeleton class="h-4 w-3/4" />
                <Skeleton class="h-3 w-1/2" />
              </div>
              <Skeleton class="h-8 w-8 rounded-full" />
            </div>
          </CardHeader>
        </Card>
      </div>

      <TabsContent value="unread" class="mt-0">
        <Card v-if="!loading && unreadNotifications.length === 0">
          <CardContent class="flex flex-col items-center justify-center py-16">
            <div class="rounded-full bg-muted p-4 mb-4">
              <Bell class="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 class="text-lg font-semibold mb-2">No unread notifications</h3>
            <p class="text-sm text-muted-foreground text-center max-w-sm">
              You're all caught up!
            </p>
          </CardContent>
        </Card>

        <ScrollArea v-else class="h-[600px]">
          <div class="space-y-3">
            <Card v-for="notification in unreadNotifications" :key="notification.id"
              class="transition-all hover:shadow-md"
              :class="{ 'border-l-4 border-l-destructive': notification.alert_type === 'out' }">
              <CardHeader>
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-start gap-3 flex-1">
                    <div class="rounded-full p-2 shrink-0"
                      :class="notification.alert_type === 'out' ? 'bg-destructive/10' : 'bg-yellow-500/10'">
                      <AlertTriangle class="h-5 w-5"
                        :class="notification.alert_type === 'out' ? 'text-destructive' : 'text-yellow-600'" />
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <CardTitle class="text-base">
                          {{ getNotificationMessage(notification) }}
                        </CardTitle>
                        <Badge variant="outline"
                          :class="notification.alert_type === 'out' ? 'border-destructive text-destructive' : 'border-yellow-600 text-yellow-600'">
                          {{ notification.alert_type === 'out' ? 'Out of Stock' : 'Low Stock' }}
                        </Badge>
                      </div>

                      <CardDescription class="flex flex-col gap-1">
                        <span class="flex items-center gap-1">
                          <Package class="h-3 w-3" />
                          SKU: {{ notification.product_sku }}
                        </span>
                        <span class="text-xs">{{ formatDate(notification.created_at) }}</span>
                      </CardDescription>

                      <div class="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" @click="navigateToProduct(notification.product_id)">
                          <Package class="h-3 w-3 mr-1" />
                          View Product
                        </Button>
                        <Button size="sm" variant="ghost" @click="handleMarkAsSeen(notification.id)">
                          <CheckCheck class="h-3 w-3 mr-1" />
                          Mark as Read
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" class="shrink-0" @click="openDeleteDialog(notification.id)">
                    <Trash2 class="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="all" class="mt-0">
        <Card v-if="!loading && notifications.length === 0">
          <CardContent class="flex flex-col items-center justify-center py-16">
            <div class="rounded-full bg-muted p-4 mb-4">
              <BellOff class="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 class="text-lg font-semibold mb-2">No notifications yet</h3>
            <p class="text-sm text-muted-foreground text-center max-w-sm">
              Stock alerts will appear here when inventory levels are low.
            </p>
          </CardContent>
        </Card>

        <ScrollArea v-else class="h-[600px]">
          <div class="space-y-3">
            <Card v-for="notification in notifications" :key="notification.id" class="transition-all hover:shadow-md"
              :class="{
                'border-l-4 border-l-destructive': notification.alert_type === 'out' && !notification.is_seen,
                'opacity-60': notification.is_seen
              }">
              <CardHeader>
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-start gap-3 flex-1">
                    <div class="rounded-full p-2 shrink-0"
                      :class="notification.alert_type === 'out' ? 'bg-destructive/10' : 'bg-yellow-500/10'">
                      <AlertTriangle class="h-5 w-5"
                        :class="notification.alert_type === 'out' ? 'text-destructive' : 'text-yellow-600'" />
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <CardTitle class="text-base">
                          {{ getNotificationMessage(notification) }}
                        </CardTitle>
                        <Badge variant="outline"
                          :class="notification.alert_type === 'out' ? 'border-destructive text-destructive' : 'border-yellow-600 text-yellow-600'">
                          {{ notification.alert_type === 'out' ? 'Out of Stock' : 'Low Stock' }}
                        </Badge>
                        <Badge v-if="notification.is_seen" variant="secondary">Read</Badge>
                      </div>

                      <CardDescription class="flex flex-col gap-1">
                        <span class="flex items-center gap-1">
                          <Package class="h-3 w-3" />
                          SKU: {{ notification.product_sku }}
                        </span>
                        <span class="text-xs">{{ formatDate(notification.created_at) }}</span>
                      </CardDescription>

                      <div class="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" @click="navigateToProduct(notification.product_id)">
                          <Package class="h-3 w-3 mr-1" />
                          View Product
                        </Button>
                        <Button v-if="!notification.is_seen" size="sm" variant="ghost"
                          @click="handleMarkAsSeen(notification.id)">
                          <CheckCheck class="h-3 w-3 mr-1" />
                          Mark as Read
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" class="shrink-0" @click="openDeleteDialog(notification.id)">
                    <Trash2 class="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>

    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Notification</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this notification? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="handleDeleteNotification" class="bg-destructive hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog v-model:open="showClearDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Read Notifications</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to clear all read notifications?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="handleClearSeen" class="bg-destructive hover:bg-destructive/90">
            Clear All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>