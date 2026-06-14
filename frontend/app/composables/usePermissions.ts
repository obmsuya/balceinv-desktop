import { toast } from 'vue-sonner'

interface Permission {
  id: number
  name: string
  resource: string
  action: 'view' | 'create' | 'edit' | 'delete'
  description?: string
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const usePermissions = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  // useState instead of ref — every component that calls usePermissions()
  // shares the exact same reactive array. This is what makes groupByResource
  // in the roles dialog see the same data that fetchPermissions() filled.
  const permissions = useState<Permission[]>('perms:all', () => [])
  const userPermissions = useState<Permission[]>('perms:user', () => [])

  const loading = ref(false)

  const fetchPermissions = async (): Promise<void> => {
    // Guard: if already loaded, do nothing. Prevents clearing the array
    // mid-render which caused the blank dialog on re-open.
    if (permissions.value.length > 0) return
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Permission[]>>(`${apiBase}/api/permissions`, {
        credentials: 'include',
      })
      permissions.value = res.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch permissions')
    } finally {
      loading.value = false
    }
  }

  const fetchUserPermissions = async (userId: number): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Permission[]>>(
        `${apiBase}/api/permissions/user/${userId}`,
        { credentials: 'include' },
      )
      userPermissions.value = res.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch user permissions')
    } finally {
      loading.value = false
    }
  }

  const fetchRolePermissions = async (roleId: number): Promise<Permission[]> => {
    try {
      const res = await $apiFetch<ApiResponse<Permission[]>>(
        `${apiBase}/api/permissions/role/${roleId}`,
        { credentials: 'include' },
      )
      return res.data ?? []
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch role permissions')
      return []
    }
  }

  const assignPermissionsToRole = async (roleId: number, permissionIds: number[]): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<null>>(`${apiBase}/api/permissions/assign-role`, {
        method: 'POST',
        body: { roleId, permissionIds },
        credentials: 'include',
      })
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to assign permissions')
      throw error
    } finally {
      loading.value = false
    }
  }

  const assignPermissionsToUser = async (userId: number, permissionIds: number[]): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<null>>(`${apiBase}/api/permissions/assign-user`, {
        method: 'POST',
        body: { userId, permissionIds },
        credentials: 'include',
      })
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to assign permissions')
      throw error
    } finally {
      loading.value = false
    }
  }

  const clearPermissions = () => {
    userPermissions.value = []
  }

  const hasPermission = (resource: string, action: string): boolean =>
    userPermissions.value.some(p => p.resource === resource && p.action === action)

  const canView   = (resource: string): boolean => hasPermission(resource, 'view')
  const canCreate = (resource: string): boolean => hasPermission(resource, 'create')
  const canEdit   = (resource: string): boolean => hasPermission(resource, 'edit')
  const canDelete = (resource: string): boolean => hasPermission(resource, 'delete')

  const groupByResource = computed(() => {
    const grouped: Record<string, Permission[]> = {}
    for (const p of permissions.value) {
      if (!grouped[p.resource]) grouped[p.resource] = []
      grouped[p.resource]!.push(p)
    }
    return grouped
  })

  return {
    permissions,
    userPermissions,
    loading,
    groupByResource,
    fetchPermissions,
    fetchUserPermissions,
    fetchRolePermissions,
    assignPermissionsToRole,
    assignPermissionsToUser,
    clearPermissions,
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
  }
}