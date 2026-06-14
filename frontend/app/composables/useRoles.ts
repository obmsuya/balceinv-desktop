import { toast } from 'vue-sonner'

interface Role {
  id: number
  name: string
  users?: Array<{
    id: number
    name: string
    email: string
  }>
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const useRoles = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const roles = ref<Role[]>([])
  const loading = ref(false)
  const selectedRole = ref<Role | null>(null)

  const fetchRoles = async (): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Role[]>>(`${apiBase}/api/roles`, {
        credentials: 'include' as const,
      })
      roles.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch roles')
    } finally {
      loading.value = false
    }
  }

  const fetchRole = async (id: number): Promise<Role | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Role>>(`${apiBase}/api/roles/${id}`, {
        credentials: 'include' as const,
      })
      selectedRole.value = res.data
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch role')
    } finally {
      loading.value = false
    }
  }

  const createRole = async (name: string): Promise<Role | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Role>>(`${apiBase}/api/roles`, {
        method: 'POST' as const,
        body: { name },
        credentials: 'include' as const,
      })
      roles.value.push(res.data)
      toast.success(res.message)
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create role')
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateRole = async (id: number, name: string): Promise<Role | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<Role>>(`${apiBase}/api/roles/${id}`, {
        method: 'PUT' as const,
        body: { name },
        credentials: 'include' as const,
      })
      const index = roles.value.findIndex(r => r.id === id)
      if (index !== -1) roles.value[index] = res.data
      toast.success(res.message)
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update role')
      throw error
    } finally {
      loading.value = false
    }
  }

  const deleteRole = async (id: number): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<null>>(`${apiBase}/api/roles/${id}`, {
        method: 'DELETE' as const,
        credentials: 'include' as const,
      })
      roles.value = roles.value.filter(r => r.id !== id)
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete role')
      throw error
    } finally {
      loading.value = false
    }
  }

  const assignRole = async (userId: number, roleId: number): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<null>>(`${apiBase}/api/roles/assign`, {
        method: 'POST' as const,
        body: { userId, roleId },
        credentials: 'include' as const,
      })
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to assign role')
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    roles,
    loading,
    selectedRole,
    fetchRoles,
    fetchRole,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
  }
}