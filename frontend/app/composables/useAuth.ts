import { toast } from 'vue-sonner'

interface User {
  id: number
  name: string
  email: string
  role: string
  company_id: number
}

export const useAuth = () => {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBase

  const user = useState<User | null>('auth:user', () => null)
  const userPermissions = useState<any[]>('perms:user', () => [])
  const isLoading = ref(false)

  if (typeof globalThis !== 'undefined' && !user.value) {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { user.value = JSON.parse(stored) }
      catch { localStorage.removeItem('user') }
    }
  }

  const login = async (credentials: { email: string; password: string }) => {
    isLoading.value = true
    try {
      const res = await $fetch<{ success: boolean; data?: { user: User }; message: string }>(
        `${baseUrl}/api/auth/login`,
        { method: 'POST', body: credentials, credentials: 'include' }
      )

      if (res.success && res.data?.user) {
        user.value = res.data.user
        if (typeof globalThis !== 'undefined') localStorage.setItem('user', JSON.stringify(res.data.user))

        try {
          const permRes = await $fetch<{ success: boolean; data: any[] }>(
            `${baseUrl}/api/permissions/user/${res.data.user.id}`,
            { credentials: 'include' }
          )
          if (permRes.success) userPermissions.value = permRes.data ?? []
        } catch {}

        return res
      }

      throw new Error(res.message || 'Login failed')
    } catch (err: any) {
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    isLoading.value = true
    try {
      await $fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch {}
    finally {
      user.value = null
      userPermissions.value = []
      if (typeof globalThis !== 'undefined') localStorage.removeItem('user')
      isLoading.value = false
      toast.success('Signed out successfully')
      await navigateTo('/login')
    }
  }

  const setup = async (values: {
    business_name: string
    business_type: string
    phone?: string
    address?: string
    tin?: string
    owner_name: string
    owner_email: string
    owner_password: string
  }) => {
    isLoading.value = true
    try {
      const res = await $fetch<{ success: boolean; message: string }>(
        `${baseUrl}/api/setup`,
        { method: 'POST', body: values, credentials: 'include' }
      )
      return res
    } catch (err: any) {
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const checkSetup = async () => {
    try {
      const res = await $fetch<{ success: boolean; data?: { configured: boolean } }>(
        `${baseUrl}/api/setup/status`,
        { credentials: 'include' }
      )
      return res.data?.configured ?? false
    } catch {
      return false
    }
  }

  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    login,
    logout,
    setup,
    setupAdmin: setup,
    checkSetup,
  }
}