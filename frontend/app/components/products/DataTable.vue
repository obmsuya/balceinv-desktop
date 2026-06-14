<script setup lang="ts">
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/vue-table'
import { Search, Filter, GitBranch } from 'lucide-vue-next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DataTableProps {
  columns: ColumnDef<any, any>[]
  data: any[]
}

const props = defineProps<DataTableProps>()

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const showVariantsOnly = ref(false)

const categories = computed(() => {
  const uniqueCategories = new Set(
    props.data
      .map(product => product.category)
      .filter((category): category is string => category != null),
  )
  return Array.from(uniqueCategories).sort()
})

const filteredData = computed(() => {
  if (!showVariantsOnly.value) return props.data
  return props.data.filter(product => product.parent_id != null)
})

const table = useVueTable({
  get data() {
    return filteredData.value
  },
  get columns() {
    return props.columns
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: updaterOrValue => {
    sorting.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting.value)
        : updaterOrValue
  },
  onColumnFiltersChange: updaterOrValue => {
    columnFilters.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(columnFilters.value)
        : updaterOrValue
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get columnFilters() {
      return columnFilters.value
    },
  },
})

const totalProducts = computed(() => table.getFilteredRowModel().rows.length)
const variantCount = computed(() => props.data.filter(product => product.parent_id != null).length)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col sm:flex-row gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name or SKU..."
          :model-value="(table.getColumn('name')?.getFilterValue() as string) ?? ''"
          @update:model-value="table.getColumn('name')?.setFilterValue($event)"
          class="pl-9"
        />
      </div>

      <Select
        :model-value="(table.getColumn('category')?.getFilterValue() as string) ?? 'all'"
        @update:model-value="
          table.getColumn('category')?.setFilterValue($event === 'all' ? '' : $event)
        "
      >
        <SelectTrigger class="w-full sm:w-[200px]">
          <Filter class="mr-2 h-4 w-4" />
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem v-for="category in categories" :key="category" :value="category">
              {{ category }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button
        v-if="variantCount > 0"
        :variant="showVariantsOnly ? 'default' : 'outline'"
        class="shrink-0"
        @click="showVariantsOnly = !showVariantsOnly"
      >
        <GitBranch class="mr-2 h-4 w-4" />
        Variants
        <span class="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-xs tabular-nums">
          {{ variantCount }}
        </span>
      </Button>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :class="header.column.id === 'image' ? 'w-14' : ''"
            >
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows?.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() && 'selected'"
              :class="row.original.parent_id != null ? 'bg-muted/30' : ''"
            >
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="columns.length" class="h-32 text-center text-muted-foreground">
              No products found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-1">
      <p class="text-sm text-muted-foreground">
        {{ totalProducts }} {{ totalProducts === 1 ? 'product' : 'products' }}
        <template v-if="variantCount > 0">
          · {{ variantCount }} {{ variantCount === 1 ? 'variant' : 'variants' }}
        </template>
      </p>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          Previous
        </Button>
        <span class="text-sm text-muted-foreground tabular-nums">
          Page {{ table.getState().pagination.pageIndex + 1 }} of {{ table.getPageCount() || 1 }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()"
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</template>