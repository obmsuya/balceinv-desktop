import type { ColumnDef } from '@tanstack/vue-table'
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Eye, AlertTriangle, ImageOff, GitBranch } from 'lucide-vue-next'
import { h } from 'vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/composables/useProducts'

export interface ActionHandlers {
  onView: (product: Product) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onAddVariant: (product: Product) => void
  canEdit: boolean
  canDelete: boolean
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(value)

const renderImageFrame = (imageDataURI: string | null | undefined, productName: string) => {
  const frameClasses = 'relative flex items-center justify-center rounded-md border bg-muted overflow-hidden flex-shrink-0'
  const frameSizeClasses = 'w-10 h-10'

  if (imageDataURI) {
    return h('div', { class: `${frameClasses} ${frameSizeClasses}` }, [
      h('img', {
        src: imageDataURI,
        alt: productName,
        class: 'w-full h-full object-cover',
      }),
    ])
  }

  return h('div', { class: `${frameClasses} ${frameSizeClasses}` }, [
    h(ImageOff, { class: 'w-4 h-4 text-muted-foreground/40' }),
  ])
}

export const createColumns = (handlers: ActionHandlers): ColumnDef<Product>[] => [
  {
    id: 'image',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => renderImageFrame(row.original.image, row.original.name),
  },
  {
    accessorKey: 'name',
    header: ({ column }) =>
      h(Button, {
        variant: 'ghost',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      }, () => ['Product', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]),
    cell: ({ row }) => {
      const product = row.original
      const isVariant = product.parent_id != null
      const hasVariants = product.variants && product.variants.length > 0

      return h('div', { class: 'flex flex-col gap-0.5 min-w-0' }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'font-semibold truncate' }, product.name),
          isVariant && h(Badge, { variant: 'outline', class: 'text-xs shrink-0' }, () => [
            product.variant_label,
          ]),
          hasVariants && h('div', { class: 'flex items-center gap-1 text-muted-foreground' }, [
            h(GitBranch, { class: 'h-3 w-3' }),
            h('span', { class: 'text-xs' }, `${product.variants!.length}`),
          ]),
        ]),
        h('span', { class: 'text-xs text-muted-foreground font-mono' }, product.sku),
      ])
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const category = row.getValue('category') as string | null
      return category
        ? h(Badge, { variant: 'outline' }, () => category)
        : h('span', { class: 'text-muted-foreground text-sm' }, '—')
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'price',
    header: ({ column }) =>
      h(Button, {
        variant: 'ghost',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      }, () => ['Price', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]),
    cell: ({ row }) =>
      h('div', { class: 'font-medium tabular-nums' }, formatCurrency(row.getValue('price'))),
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) =>
      h(Button, {
        variant: 'ghost',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      }, () => ['Stock', h(ArrowUpDown, { class: 'ml-2 h-4 w-4' })]),
    cell: ({ row }) => {
      const quantity = row.getValue('quantity') as number
      const minStock = row.original.min_stock
      const unit = row.original.unit
      const isLow = quantity <= minStock
      const isOut = quantity === 0

      return h('div', { class: 'flex items-center gap-2' }, [
        isLow && h(AlertTriangle, {
          class: `h-4 w-4 ${isOut ? 'text-destructive' : 'text-orange-500'}`,
        }),
        h(Badge, {
          variant: isOut ? 'destructive' : isLow ? 'outline' : 'secondary',
          class: isLow && !isOut ? 'border-orange-500 text-orange-600' : '',
        }, () => `${quantity} ${unit}`),
      ])
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const product = row.original
      const isVariant = product.parent_id != null

      return h(DropdownMenu, null, {
        default: () => [
          h(DropdownMenuTrigger, { asChild: true }, () =>
            h(Button, { variant: 'ghost', class: 'h-8 w-8 p-0' }, () => [
              h('span', { class: 'sr-only' }, 'Open menu'),
              h(MoreHorizontal, { class: 'h-4 w-4' }),
            ]),
          ),
          h(DropdownMenuContent, { align: 'end' }, () => [
            h(DropdownMenuLabel, null, () => product.name),
            h(DropdownMenuSeparator),
            h(DropdownMenuGroup, null, () => [
              h(DropdownMenuItem, { onClick: () => handlers.onView(product) }, () => [
                h(Eye, { class: 'mr-2 h-4 w-4' }),
                'View Details',
              ]),
              handlers.canEdit && h(DropdownMenuItem, { onClick: () => handlers.onEdit(product) }, () => [
                h(Pencil, { class: 'mr-2 h-4 w-4' }),
                'Edit',
              ]),
              !isVariant && handlers.canEdit && h(DropdownMenuItem, {
                onClick: () => handlers.onAddVariant(product),
              }, () => [
                h(GitBranch, { class: 'mr-2 h-4 w-4' }),
                'Add Variant',
              ]),
            ]),
            handlers.canDelete && h(DropdownMenuSeparator),
            handlers.canDelete && h(DropdownMenuGroup, null, () => [
              h(DropdownMenuItem, {
                class: 'text-destructive focus:text-destructive',
                onClick: () => handlers.onDelete(product),
              }, () => [
                h(Trash2, { class: 'mr-2 h-4 w-4' }),
                'Delete',
              ]),
            ]),
          ]),
        ],
      })
    },
  },
]