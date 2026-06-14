// middleware/permissions.ts
// This middleware runs on protected routes to verify the current user
// has permission to view the page they are navigating to.
// It relies on usePermissions which fetches permission data from the Go API.
// The auth.global.ts middleware runs first and ensures user is always set
// before this middleware is reached on any protected route.
export default defineNuxtRouteMiddleware(async (to) => {
  const { user } = useAuth()

  // If there is no user in state, the auth middleware should have already
  // redirected to login. This guard is a safety net for edge cases.
  if (!user.value) {
    return navigateTo('/login')
  }

  // SuperAdmin bypasses all permission checks — they have access to everything.
  // This matches the seeding logic where SuperAdmin receives every permission.
  if (user.value.role === 'SuperAdmin') return

  // Map each protected route path to the permission it requires.
  // The resource names match exactly what was seeded into the permissions table.
  const routePermissions: Record<string, { resource: string; action: string }> = {
    '/pos': { resource: 'sales', action: 'create' },
    '/sales': { resource: 'sales', action: 'view' },
    '/products': { resource: 'products', action: 'view' },
    '/stock-movements': { resource: 'stock_movements', action: 'view' },
    '/reports': { resource: 'reports', action: 'view' },
    '/notifications': { resource: 'notifications', action: 'view' },
    '/users': { resource: 'users', action: 'view' },
    '/roles': { resource: 'roles', action: 'view' },
    '/settings': { resource: 'settings', action: 'view' },
  }

  // Find the most specific matching route key for the current path.
  // startsWith handles nested routes like /products/123 matching /products.
  const matchedKey = Object.keys(routePermissions).find(
    key => to.path === key || to.path.startsWith(key + '/')
  )

  // If the route is not in the map, it is either public or unprotected — allow it.
  if (!matchedKey) return

  const required = routePermissions[matchedKey]!

  // Fetch this user's permissions from the Go API.
  // We use $fetch directly here rather than usePermissions because middleware
  // runs before components mount, so composable state may not be initialised yet.
  const { public: { apiBase } } = useRuntimeConfig()

  try {
    const res = await $fetch<{ success: boolean; data: Array<{ resource: string; action: string }> }>(
      `${apiBase}/api/permissions/user/${user.value.id}`,
      { credentials: 'include' as const }
    )

    const hasPermission = res.data.some(
      p => p.resource === required.resource && p.action === required.action
    )

    if (!hasPermission) {
      return navigateTo('/unauthorized')
    }
  } catch {
    // If the permission check itself fails (network error, 401 etc),
    // redirect to unauthorized rather than letting the user through.
    return navigateTo('/unauthorized')
  }
})