import { ref, computed } from "vue";
import { toast } from "vue-sonner";

export interface Notification {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  current_quantity: number
  threshold: number
  alert_type: 'low' | 'out'
  is_seen: boolean
  created_at: Date
}

export const useNotifications = () => {
  const {
    public: { apiBase },
  } = useRuntimeConfig();
  const { $apiFetch } = useNuxtApp();

  const notifications = ref<Notification[]>([]);
  const notificationCount = ref(0);
  const loading = ref(false);
  const soundEnabled = ref(true);
  const isClient = globalThis !== undefined && (globalThis as any).window !== undefined;

  let audioContext: AudioContext | null = null;

  const initAudio = () => {
    if (isClient && !audioContext) {
      const g = globalThis as any;
      const Ctx = g.window?.AudioContext || g.window?.webkitAudioContext || g.AudioContext || g.webkitAudioContext;
      if (Ctx) audioContext = new Ctx();
    }
  };

  // Two quick beeps — first at 800Hz then at 1000Hz — so the cashier knows
  // something happened without it being intrusive or alarming.
  const playNotificationSound = () => {
    if (!soundEnabled.value || !isClient) return;
    try {
      initAudio();
      if (!audioContext) return;

      const beep = (freq: number, start: number, duration: number) => {
        if (!audioContext) return;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.value = 0.3;
        osc.start(audioContext.currentTime + start);
        osc.stop(audioContext.currentTime + start + duration);
      };

      beep(800, 0, 0.2);
      beep(1000, 0.25, 0.2);
    } catch {
      // Sound failure is silent — never block the UI over an audio error
    }
  };

  const fetchNotifications = async (includeSeen = false): Promise<void> => {
    loading.value = true;
    try {
      const res = await $apiFetch<any>(`${apiBase}/api/notifications`, {
        query: { includeSeen: includeSeen.toString() },
        credentials: "include",
      });

      if (res.success) {
        const oldCount = notificationCount.value;
        notifications.value = res.data;
        notificationCount.value = res.data.filter(
          (n: Notification) => !n.is_seen,
        ).length;

        if (notificationCount.value > oldCount && oldCount > 0) {
          playNotificationSound();
        }
      }
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to fetch notifications");
    } finally {
      loading.value = false;
    }
  };

  // Lightweight poll — called on a timer from the app header so the badge
  // stays accurate without fetching full notification data every time.
  const fetchNotificationCount = async (): Promise<void> => {
    try {
      const res = await $apiFetch<any>(`${apiBase}/api/notifications/count`, {
        credentials: "include",
      });

      if (res.success) {
        const oldCount = notificationCount.value;
        notificationCount.value = res.count;

        if (notificationCount.value > oldCount && oldCount > 0) {
          playNotificationSound();
        }
      }
    } catch {
      // Count failures are silent — a missing badge number is not worth a toast
    }
  };

  const markAsSeen = async (notificationId: number): Promise<void> => {
    try {
      await $apiFetch(`${apiBase}/api/notifications/${notificationId}/mark-seen`, {
        method: "POST" as const,
        credentials: "include",
      });

      const notification = notifications.value.find(
        (n) => n.id === notificationId,
      );
      if (notification) {
        notification.is_seen = true;
        notificationCount.value = Math.max(0, notificationCount.value - 1);
      }
    } catch (error: any) {
      toast.error(
        error?.data?.message || "Failed to mark notification as read",
      );
      throw error;
    }
  };

  const markAllAsSeen = async (): Promise<void> => {
    try {
      await $apiFetch(`${apiBase}/api/notifications/mark-all-seen`, {
        method: "POST",
        credentials: "include",
      });

      notifications.value.forEach((n) => (n.is_seen = true));
      notificationCount.value = 0;
    } catch (error: any) {
      toast.error(
        error?.data?.message || "Failed to mark all notifications as read",
      );
      throw error;
    }
  };

  const deleteNotification = async (notificationId: number): Promise<void> => {
    try {
      await $apiFetch(`${apiBase}/api/notifications/${notificationId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const index = notifications.value.findIndex(
        (n) => n.id === notificationId,
      );
      if (index !== -1) {
        const wasUnseen = !notifications.value[index]?.is_seen;
        notifications.value.splice(index, 1);
        if (wasUnseen)
          notificationCount.value = Math.max(0, notificationCount.value - 1);
      }
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete notification");
      throw error;
    }
  };

  const clearSeenNotifications = async (): Promise<void> => {
    try {
      await $apiFetch(`${apiBase}/api/notifications/clear-seen`, {
        method: "DELETE",
        credentials: "include",
      });

      notifications.value = notifications.value.filter((n) => !n.is_seen);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to clear notifications");
      throw error;
    }
  };

  const toggleSound = (): void => {
    soundEnabled.value = !soundEnabled.value;
    if (isClient) {
      localStorage.setItem(
        "notification-sound-enabled",
        soundEnabled.value.toString(),
      );
    }
  };

  const loadSoundSetting = (): void => {
    if (isClient) {
      const saved = localStorage.getItem("notification-sound-enabled");
      if (saved !== null) soundEnabled.value = saved === "true";
    }
  };

  const unreadNotifications = computed(() =>
    notifications.value.filter((n) => !n.is_seen),
  );
  const hasUnread = computed(() => notificationCount.value > 0);

  return {
    notifications,
    notificationCount,
    loading,
    soundEnabled,
    unreadNotifications,
    hasUnread,
    fetchNotifications,
    fetchNotificationCount,
    markAsSeen,
    markAllAsSeen,
    deleteNotification,
    clearSeenNotifications,
    playNotificationSound,
    toggleSound,
    loadSoundSetting,
  };
};
