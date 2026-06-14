<script setup lang="ts">
import { Plus, Users as UsersIcon, Shield } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { columns } from '@/components/roles/columns';
import DataTable from '@/components/roles/DataTable.vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { usePermissions } from '@/composables/usePermissions';

const { roles, loading, fetchRoles, createRole, updateRole, deleteRole } = useRoles();
const { permissions, groupByResource, fetchPermissions, fetchRolePermissions, assignPermissionsToRole } = usePermissions();

const showDialog = ref(false);
const showDeleteDialog = ref(false);
const showUsersDialog = ref(false);
const showPermissionsDialog = ref(false);
const isEditing = ref(false);
const selectedRole = ref<any>(null);
const roleName = ref('');
const selectedPermissions = ref<number[]>([]);
const permissionsLoading = ref(false);

const allPermissionIds = computed(() => permissions.value.map((p) => p.id));

const allSelected = computed(
  () => allPermissionIds.value.length > 0 && allPermissionIds.value.every((id) => selectedPermissions.value.includes(id))
);

const toggleAll = () => {
  if (allSelected.value) {
    selectedPermissions.value = [];
  } else {
    selectedPermissions.value = [...allPermissionIds.value];
  }
};

const isResourceAllSelected = (perms: any[]) =>
  perms.every((p) => selectedPermissions.value.includes(p.id));

const toggleResource = (perms: any[]) => {
  if (isResourceAllSelected(perms)) {
    const ids = new Set(perms.map((p) => p.id));
    selectedPermissions.value = selectedPermissions.value.filter((id) => !ids.has(id));
  } else {
    const toAdd = perms.map((p) => p.id).filter((id) => !selectedPermissions.value.includes(id));
    selectedPermissions.value = [...selectedPermissions.value, ...toAdd];
  }
};

const isPermissionSelected = (id: number) => selectedPermissions.value.includes(id);

const togglePermission = (id: number) => {
  if (selectedPermissions.value.includes(id)) {
    selectedPermissions.value = selectedPermissions.value.filter((x) => x !== id);
  } else {
    selectedPermissions.value = [...selectedPermissions.value, id];
  }
};

const { user } = useAuth();
const { fetchUserPermissions } = usePermissions();

onMounted(async () => {
  if (user.value) await fetchUserPermissions(user.value.id);
  await fetchRoles();
  await fetchPermissions();
  globalThis.addEventListener('edit-role', handleEdit);
  globalThis.addEventListener('delete-role', handleDelete);
  globalThis.addEventListener('view-users', handleViewUsers);
  globalThis.addEventListener('manage-permissions', handleManagePermissions);
});

onUnmounted(() => {
  globalThis.removeEventListener('edit-role', handleEdit);
  globalThis.removeEventListener('delete-role', handleDelete);
  globalThis.removeEventListener('view-users', handleViewUsers);
  globalThis.removeEventListener('manage-permissions', handleManagePermissions);
});

const handleEdit = (event: any) => {
  selectedRole.value = event.detail;
  roleName.value = event.detail.name;
  isEditing.value = true;
  showDialog.value = true;
};

const handleDelete = (event: any) => {
  selectedRole.value = event.detail;
  showDeleteDialog.value = true;
};

const handleViewUsers = (event: any) => {
  selectedRole.value = event.detail;
  showUsersDialog.value = true;
};

const handleManagePermissions = async (event: any) => {
  selectedRole.value = event.detail;
  selectedPermissions.value = [];
  showPermissionsDialog.value = true;
  permissionsLoading.value = true;
  try {
    const rolePerms = await fetchRolePermissions(event.detail.id);
    selectedPermissions.value = rolePerms
      .map((p: any) => Number(p.id))
      .filter((id: number) => id > 0);
  } finally {
    permissionsLoading.value = false;
  }
};

const openCreateDialog = () => {
  selectedRole.value = null;
  roleName.value = '';
  isEditing.value = false;
  showDialog.value = true;
};

const handleSubmit = async () => {
  if (!roleName.value.trim()) { toast.error('Role name is required'); return; }
  try {
    if (isEditing.value && selectedRole.value) {
      await updateRole(selectedRole.value.id, roleName.value);
    } else {
      await createRole(roleName.value);
    }
    showDialog.value = false;
    roleName.value = '';
  } catch (error) {
    console.error('Failed to save role:', error);
  }
};

const confirmDelete = async () => {
  if (selectedRole.value) {
    try {
      await deleteRole(selectedRole.value.id);
      showDeleteDialog.value = false;
      selectedRole.value = null;
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  }
};

const handleSavePermissions = async () => {
  if (selectedRole.value) {
    try {
      await assignPermissionsToRole(selectedRole.value.id, selectedPermissions.value);
      showPermissionsDialog.value = false;
      selectedPermissions.value = [];
    } catch (error) {
      console.error('Failed to save permissions:', error);
    }
  }
};
</script>

<template>
  <div class="container mx-auto py-6 px-4 space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Roles Management</h1>
        <p class="text-muted-foreground mt-1">Manage user roles and permissions</p>
      </div>
      <Button @click="openCreateDialog" :disabled="loading">
        <Plus class="mr-2 h-4 w-4" />
        Add Role
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>All Roles</CardTitle>
        <CardDescription>A list of all roles in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable :columns="columns" :data="roles" />
      </CardContent>
    </Card>

    <Dialog v-model:open="showDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Edit Role' : 'Create New Role' }}</DialogTitle>
          <DialogDescription>{{ isEditing ? 'Update the role name' : 'Add a new role to the system' }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="role-name">Role Name</Label>
            <Input id="role-name" v-model="roleName" placeholder="Enter role name" @keyup.enter="handleSubmit" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDialog = false">Cancel</Button>
          <Button @click="handleSubmit" :disabled="!roleName.trim()">{{ isEditing ? 'Update' : 'Create' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete the role "{{ selectedRole?.name }}". This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog v-model:open="showUsersDialog">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <UsersIcon class="h-5 w-5" />
            Users with {{ selectedRole?.name }} Role
          </DialogTitle>
        </DialogHeader>
        <div class="py-4">
          <div v-if="selectedRole?.users?.length" class="space-y-2">
            <div v-for="user in selectedRole.users" :key="user.id" class="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p class="font-medium">{{ user.name }}</p>
                <p class="text-sm text-muted-foreground">{{ user.email }}</p>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-muted-foreground">No users assigned to this role</div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showPermissionsDialog">
      <DialogContent class="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Shield class="h-5 w-5" />
            Manage Permissions for {{ selectedRole?.name }}
          </DialogTitle>
          <DialogDescription>Select the permissions this role should have</DialogDescription>
        </DialogHeader>

        <div v-if="permissionsLoading" class="py-12 text-center text-muted-foreground text-sm">
          Loading permissions...
        </div>

        <div v-else class="py-4 space-y-6">

          <div class="flex items-center justify-between rounded-lg border px-4 py-3 bg-muted/40">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                id="perm-select-all"
                class="perm-box"
                :checked="allSelected"
                @change="toggleAll"
              />
              <label for="perm-select-all" class="text-sm font-semibold cursor-pointer select-none">
                Select all permissions
              </label>
            </div>
            <span class="text-xs text-muted-foreground">
              {{ selectedPermissions.length }} / {{ allPermissionIds.length }} selected
            </span>
          </div>

          <div v-for="(perms, resource) in groupByResource" :key="resource" class="space-y-3">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                :id="`perm-resource-${resource}`"
                class="perm-box"
                :checked="isResourceAllSelected(perms)"
                @change="toggleResource(perms)"
              />
              <label
                :for="`perm-resource-${resource}`"
                class="text-sm font-semibold uppercase text-muted-foreground cursor-pointer select-none"
              >
                {{ resource }}
              </label>
            </div>
            <Separator />
            <div class="grid grid-cols-2 gap-3 pl-6">
              <div
                v-for="permission in perms"
                :key="permission.id"
                class="flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  :id="`perm-${permission.id}`"
                  class="perm-box"
                  :checked="isPermissionSelected(permission.id)"
                  @change="togglePermission(permission.id)"
                />
                <label
                  :for="`perm-${permission.id}`"
                  class="text-sm font-medium capitalize cursor-pointer select-none"
                >
                  {{ permission.action }}
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showPermissionsDialog = false">Cancel</Button>
          <Button @click="handleSavePermissions" :disabled="permissionsLoading">Save Permissions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.perm-box {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  min-width: 16px;
  border-radius: 4px;
  border: 1.5px solid hsl(var(--border));
  background: hsl(var(--background));
  cursor: pointer;
  position: relative;
  transition: background 0.12s, border-color 0.12s;
  flex-shrink: 0;
}

.perm-box:checked {
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.perm-box:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: 2px solid white;
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}
</style>