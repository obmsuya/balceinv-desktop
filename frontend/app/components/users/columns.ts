import type { ColumnDef } from '@tanstack/vue-table';
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, KeyRound } from 'lucide-vue-next';
import { h } from 'vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface User {
  id: number;
  name: string;
  email: string;
  roleId: number;
  role: {
    id: number;
    name: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => {
      return h(Button, {
        variant: 'ghost',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      }, () => ['ID', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]);
    },
    cell: ({ row }) => h('div', { class: 'font-medium' }, row.getValue('id')),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return h(Button, {
        variant: 'ghost',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      }, () => ['Name', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]);
    },
    cell: ({ row }) => h('div', { class: 'font-semibold' }, row.getValue('name')),
  },
  {
    accessorKey: 'email',
    header: ({ column }) => {
      return h(Button, {
        variant: 'ghost',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      }, () => ['Email', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]);
    },
    cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, row.getValue('email')),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
      const role = row.original.role;
      const variant = role.name === 'SuperAdmin' ? 'destructive' : 
                     role.name === 'Admin' ? 'default' : 
                     role.name === 'Manager' ? 'secondary' : 'outline';
      
      return h(Badge, { variant }, () => role.name);
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: ({ row }) => {
      const date = new Date(row.getValue('createdAt'));
      return h('div', { class: 'text-sm text-muted-foreground' }, 
        date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      );
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const user = row.original;

      return h(DropdownMenu, null, {
        default: () => [
          h(DropdownMenuTrigger, { asChild: true }, () =>
            h(Button, { variant: 'ghost', class: 'h-8 w-8 p-0' }, () => [
              h('span', { class: 'sr-only' }, 'Open menu'),
              h(MoreHorizontal, { class: 'h-4 w-4' })
            ])
          ),
          h(DropdownMenuContent, { align: 'end' }, () => [
            h(DropdownMenuLabel, null, () => 'Actions'),
            h(DropdownMenuSeparator),
            h(DropdownMenuItem, {
              onClick: () => {
                const event = new CustomEvent('edit-user', { detail: user });
                window.dispatchEvent(event);
              }
            }, () => [
              h(Pencil, { class: 'mr-2 h-4 w-4' }),
              'Edit'
            ]),
            h(DropdownMenuItem, {
              onClick: () => {
                const event = new CustomEvent('update-password', { detail: user });
                window.dispatchEvent(event);
              }
            }, () => [
              h(KeyRound, { class: 'mr-2 h-4 w-4' }),
              'Update Password'
            ]),
            h(DropdownMenuSeparator),
            h(DropdownMenuItem, {
              class: 'text-destructive',
              onClick: () => {
                const event = new CustomEvent('delete-user', { detail: user });
                window.dispatchEvent(event);
              }
            }, () => [
              h(Trash2, { class: 'mr-2 h-4 w-4' }),
              'Delete'
            ]),
          ])
        ]
      });
    },
  },
];