export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiBase

  let refreshPromise: Promise<void> | null = null

  const doRefresh = (): Promise<void> => {
    if (refreshPromise !== null) return refreshPromise

    refreshPromise = $fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST' as const,
      credentials: 'include' as const,
    })
      .then(() => {
        refreshPromise = null
      })
      .catch(async () => {
        refreshPromise = null
        const user = useState('auth:user')
        const userPermissions = useState('perms:user')
        user.value = null
        userPermissions.value = []
        if (import.meta.client) {
          localStorage.removeItem('user')
          localStorage.removeItem('pos-cart-state')
        }
        await nuxtApp.runWithContext(() => navigateTo('/login'))
      })

    return refreshPromise
  }

  const resolveRequestUrl = (request: Parameters<typeof $fetch>[0]): string => {
    if (typeof request === 'string') return request
    if (request instanceof URL) return request.toString()
    return request.url
  }

  const apiFetch = $fetch.create({
    credentials: 'include',
    async onResponseError({ response, request }) {
      const requestUrl = resolveRequestUrl(request)

      const isAuthEndpoint =
        requestUrl.includes('/auth/refresh') ||
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/me')

      if (response.status === 401 && !isAuthEndpoint) {
        await doRefresh()
      }
    },
  })

  return { provide: { apiFetch } }
})