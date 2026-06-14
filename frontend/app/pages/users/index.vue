<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { columns } from '@/components/users/columns';
import DataTable from '@/components/users/DataTable.vue';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsers } from '~/composables/useUsers';


const { users, loading, fetchUsers, createUser, updateUser, updatePassword, deleteUser } = useUsers();
const { roles, fetchRoles } = useRoles();

const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const showPasswordDialog = ref(false);
const showDeleteDialog = ref(false);
const selectedUser = ref<any>(null);

const formData = ref({
  name: '',
  email: '',
  password: '',
  roleId: 0,
});

const newPassword = ref('');

const { user } = useAuth()
const { fetchUserPermissions } = usePermissions()
onMounted(async () => {
  if (user.value) await fetchUserPermissions(user.value.id)
  await fetchUsers();
  await fetchRoles();
  
  globalThis.addEventListener('edit-user', handleEdit);
  globalThis.addEventListener('update-password', handleUpdatePassword);
  globalThis.addEventListener('delete-user', handleDelete);
});

onUnmounted(() => {
  globalThis.removeEventListener('edit-user', handleEdit);
  globalThis.removeEventListener('update-password', handleUpdatePassword);
  globalThis.removeEventListener('delete-user', handleDelete);
});

const handleEdit = (event: any) => {
  selectedUser.value = event.detail;
  formData.value = {
    name: event.detail.name,
    email: event.detail.email,
    password: '',
    roleId: event.detail.roleId,
  };
  showEditDialog.value = true;
};

const handleUpdatePassword = (event: any) => {
  selectedUser.value = event.detail;
  newPassword.value = '';
  showPasswordDialog.value = true;
};

const handleDelete = (event: any) => {
  selectedUser.value = event.detail;
  showDeleteDialog.value = true;
};

const openCreateDialog = () => {
  formData.value = {
    name: '',
    email: '',
    password: '',
    roleId: 0,
  };
  showCreateDialog.value = true;
};

const handleCreateSubmit = async () => {
  if (!formData.value.name.trim()) {
    toast.error('Name is required');
    return;
  }
  
  if (!formData.value.email.trim()) {
    toast.error('Email is required');
    return;
  }
  
  if (!formData.value.password.trim()) {
    toast.error('Password is required');
    return;
  }
  
  if (formData.value.password.length < 6) {
    toast.error('Password must be at least 6 characters');
    return;
  }
  
  if (!formData.value.roleId) {
    toast.error('Role is required');
    return;
  }

  try {
    await createUser(formData.value);
    showCreateDialog.value = false;
    formData.value = {
      name: '',
      email: '',
      password: '',
      roleId: 0,
    };
  } catch (error) {
    console.error('Failed to create user:', error);
  }
};

const handleEditSubmit = async () => {
  if (!formData.value.name.trim()) {
    toast.error('Name is required');
    return;
  }
  
  if (!formData.value.email.trim()) {
    toast.error('Email is required');
    return;
  }
  
  if (!formData.value.roleId) {
    toast.error('Role is required');
    return;
  }

  try {
    await updateUser(selectedUser.value.id, {
      name: formData.value.name,
      email: formData.value.email,
      roleId: formData.value.roleId,
    });
    showEditDialog.value = false;
    selectedUser.value = null;
  } catch (error) {
    console.error('Failed to update user:', error);
  }
};

const handlePasswordSubmit = async () => {
  if (!newPassword.value.trim()) {
    toast.error('Password is required');
    return;
  }
  
  if (newPassword.value.length < 6) {
    toast.error('Password must be at least 6 characters');
    return;
  }

  try {
    await updatePassword(selectedUser.value.id, newPassword.value);
    showPasswordDialog.value = false;
    selectedUser.value = null;
    newPassword.value = '';
  } catch (error) {
    console.error('Failed to update password:', error);
  }
};

const confirmDelete = async () => {
  if (selectedUser.value) {
    try {
      await deleteUser(selectedUser.value.id);
      showDeleteDialog.value = false;
      selectedUser.value = null;
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  }
};
</script>

<template>
  <div class="container mx-auto py-6 px-4 space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">User Management</h1>
        <p class="text-muted-foreground mt-1">
          Manage system users and their roles
        </p>
      </div>
      <Button @click="openCreateDialog" :disabled="loading">
        <UserPlus class="mr-2 h-4 w-4" />
        Add User
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
        <CardDescription>A list of all users in the system</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable :columns="columns" :data="users" />
      </CardContent>
    </Card>

    <Dialog v-model:open="showCreateDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="create-name">Full Name</Label>
            <Input
              id="create-name"
              v-model="formData.name"
              placeholder="Enter full name"
            />
          </div>
          <div class="space-y-2">
            <Label for="create-email">Email</Label>
            <Input
              id="create-email"
              v-model="formData.email"
              type="email"
              placeholder="user@example.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="create-password">Password</Label>
            <Input
              id="create-password"
              v-model="formData.password"
              type="password"
              placeholder="Minimum 6 characters"
            />
          </div>
          <div class="space-y-2">
            <Label for="create-role">Role</Label>
            <Select v-model="formData.roleId">
              <SelectTrigger id="create-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="role in roles"
                  :key="role.id"
                  :value="role.id"
                >
                  {{ role.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false">Cancel</Button>
          <Button @click="handleCreateSubmit" :disabled="loading">
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showEditDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              v-model="formData.name"
              placeholder="Enter full name"
            />
          </div>
          <div class="space-y-2">
            <Label for="edit-email">Email</Label>
            <Input
              id="edit-email"
              v-model="formData.email"
              type="email"
              placeholder="user@example.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="edit-role">Role</Label>
            <Select v-model="formData.roleId">
              <SelectTrigger id="edit-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="role in roles"
                  :key="role.id"
                  :value="role.id"
                >
                  {{ role.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditDialog = false">Cancel</Button>
          <Button @click="handleEditSubmit" :disabled="loading">
            Update User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showPasswordDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Password</DialogTitle>
          <DialogDescription>
            Set a new password for {{ selectedUser?.name }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="new-password">New Password</Label>
            <Input
              id="new-password"
              v-model="newPassword"
              type="password"
              placeholder="Minimum 6 characters"
            />
            <p class="text-xs text-muted-foreground">
              User will be logged out of all sessions after password update
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPasswordDialog = false">Cancel</Button>
          <Button @click="handlePasswordSubmit" :disabled="loading">
            Update Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the user "{{ selectedUser?.name }}" and all associated data.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>