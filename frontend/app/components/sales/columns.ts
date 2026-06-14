import type { ColumnDef } from '@tanstack/vue-table';
import { ArrowUpDown, Eye, CreditCard, Smartphone, Banknote } from 'lucide-vue-next';
import { h, inject } from 'vue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Fields match the API snake_case response exactly
interface Sale {
  id: number;
  receipt_number: string;
  total_amount: number;
  payment_type: string;
  sale_type: string;
  tax_amount: number;
  created_at: string;
  user?: { name: string };
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(value);

const formatDate = (date: string): string =>
  new Intl.DateTimeFormat('en-TZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

const getPaymentIcon = (type: string) => {
  if (type === 'card') return CreditCard;
  if (type === 'mobile') return Smartphone;
  return Banknote;
};

export const columns: ColumnDef<Sale>[] = [
  {
    accessorKey: 'receipt_number',
    header: ({ column }) => h(Button, {
      variant: 'ghost',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
    }, () => ['Receipt #', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]),
    cell: ({ row }) => h('div', { class: 'font-mono text-sm font-medium' }, row.getValue('receipt_number')),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => h(Button, {
      variant: 'ghost',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
    }, () => ['Date', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]),
    cell: ({ row }) => h('div', { class: 'text-sm' }, formatDate(row.getValue('created_at'))),
  },
  {
    accessorKey: 'total_amount',
    header: ({ column }) => h(Button, {
      variant: 'ghost',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
    }, () => ['Amount', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]),
    cell: ({ row }) => h('div', { class: 'font-semibold' }, formatCurrency(row.getValue('total_amount'))),
  },
  {
    accessorKey: 'payment_type',
    header: 'Payment',
    cell: ({ row }) => {
      const type = row.getValue('payment_type') as string;
      return h('div', { class: 'flex items-center gap-2' }, [
        h(getPaymentIcon(type), { class: 'h-4 w-4 text-muted-foreground' }),
        h('span', { class: 'capitalize' }, type),
      ]);
    },
  },
  {
    accessorKey: 'sale_type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.getValue('sale_type') as string;
      return h(Badge, { variant: type === 'wholesale' ? 'default' : 'secondary' },
        () => type === 'wholesale' ? 'Wholesale' : 'Retail');
    },
  },
  {
    accessorKey: 'user',
    header: 'Sold By',
    cell: ({ row }) => h('div', { class: 'text-sm' }, row.original.user?.name || 'N/A'),
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      // ✅ FIX: Use inject — no window events, no leaked listeners
      const emitViewSale = inject<(sale: any) => void>('view-sale-emit');
      return h(Button, {
        variant: 'ghost',
        size: 'sm',
        onClick: () => emitViewSale?.(row.original),
      }, () => [h(Eye, { class: 'mr-2 h-4 w-4' }), 'Details']);
    },
  },
];