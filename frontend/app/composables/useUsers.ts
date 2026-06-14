import { toast } from 'vue-sonner'

interface Role {
  id: number
  name: string
}

interface User {
  id: number
  name: string
  email: string
  roleId: number
  role: Role
  createdAt: Date
  updatedAt?: Date
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export const useUsers = () => {
  const { public: { apiBase } } = useRuntimeConfig()
  const { $apiFetch } = useNuxtApp()

  const users = ref<User[]>([])
  const loading = ref(false)
  const selectedUser = ref<User | null>(null)

  const fetchUsers = async (): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<User[]>>(`${apiBase}/api/users`, {
        credentials: 'include' as const,
      })
      users.value = res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch users')
    } finally {
      loading.value = false
    }
  }

  const fetchUser = async (id: number): Promise<User | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<User>>(`${apiBase}/api/users/${id}`, {
        credentials: 'include' as const,
      })
      selectedUser.value = res.data
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to fetch user')
    } finally {
      loading.value = false
    }
  }

  const createUser = async (data: {
    name: string
    email: string
    password: string
    roleId: number
  }): Promise<User | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<User>>(`${apiBase}/api/users`, {
        method: 'POST' as const,
        body: data,
        credentials: 'include' as const,
      })
      await fetchUsers()
      toast.success(res.message)
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create user')
      throw error
    } finally {
      loading.value = false
    }
  }

  const updateUser = async (
    id: number,
    data: { name?: string; email?: string; roleId?: number }
  ): Promise<User | undefined> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<User>>(`${apiBase}/api/users/${id}`, {
        method: 'PUT' as const,
        body: data,
        credentials: 'include' as const,
      })
      await fetchUsers()
      toast.success(res.message)
      return res.data
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update user')
      throw error
    } finally {
      loading.value = false
    }
  }

  const updatePassword = async (userId: number, newPassword: string): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<null>>(`${apiBase}/api/users/update-password`, {
        method: 'POST' as const,
        body: { userId, newPassword },
        credentials: 'include' as const,
      })
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update password')
      throw error
    } finally {
      loading.value = false
    }
  }

  const deleteUser = async (id: number): Promise<void> => {
    loading.value = true
    try {
      const res = await $apiFetch<ApiResponse<null>>(`${apiBase}/api/users/${id}`, {
        method: 'DELETE' as const,
        credentials: 'include' as const,
      })
      users.value = users.value.filter(u => u.id !== id)
      toast.success(res.message)
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete user')
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    users,
    loading,
    selectedUser,
    fetchUsers,
    fetchUser,
    createUser,
    updateUser,
    updatePassword,
    deleteUser,
  }
}