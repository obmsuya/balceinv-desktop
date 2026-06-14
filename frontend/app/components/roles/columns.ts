import type { ColumnDef } from '@tanstack/vue-table';
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Users, Shield } from 'lucide-vue-next';
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

interface Role {
  id: number;
  name: string;
  users?: Array<{ id: number; name: string; email: string }>;
}

export const columns: ColumnDef<Role>[] = [
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
      }, () => ['Role Name', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]);
    },
    cell: ({ row }) => h('div', { class: 'font-semibold' }, row.getValue('name')),
  },
  {
    accessorKey: 'users',
    header: 'Users',
    cell: ({ row }) => {
      const users = row.original.users || [];
      return h(Badge, { variant: 'secondary' }, () => [
        h(Users, { class: 'mr-1 h-3 w-3' }),
        `${users.length} user${users.length !== 1 ? 's' : ''}`
      ]);
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const role = row.original;

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
                const event = new CustomEvent('edit-role', { detail: role });
                window.dispatchEvent(event);
              }
            }, () => [
              h(Pencil, { class: 'mr-2 h-4 w-4' }),
              'Edit'
            ]),
            h(DropdownMenuItem, {
              onClick: () => {
                const event = new CustomEvent('manage-permissions', { detail: role });
                window.dispatchEvent(event);
              }
            }, () => [
              h(Shield, { class: 'mr-2 h-4 w-4' }),
              'Manage Permissions'
            ]),
            h(DropdownMenuItem, {
              onClick: () => {
                const event = new CustomEvent('view-users', { detail: role });
                window.dispatchEvent(event);
              }
            }, () => [
              h(Users, { class: 'mr-2 h-4 w-4' }),
              'View Users'
            ]),
            h(DropdownMenuSeparator),
            h(DropdownMenuItem, {
              class: 'text-destructive',
              onClick: () => {
                const event = new CustomEvent('delete-role', { detail: role });
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