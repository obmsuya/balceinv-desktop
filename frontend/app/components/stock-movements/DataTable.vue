<script setup lang="ts">
import {
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table';
import type { ColumnDef, SortingState, ColumnFiltersState } from '@tanstack/vue-table';
import { Search, Calendar, Filter } from 'lucide-vue-next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import type { DateValue } from 'reka-ui';

interface DataTableProps {
  columns: ColumnDef<any, any>[];
  data: any[];
}

const props = defineProps<DataTableProps>();
const emit = defineEmits<{
  (e: 'date-filter', startDate: Date | null, endDate: Date | null): void;
  (e: 'reason-filter', reason: string): void;
  (e: 'search', query: string): void;
}>();

const sorting = ref<SortingState>([]);
const columnFilters = ref<ColumnFiltersState>([]);
const searchQuery = ref('');
const dateRange = ref<{ start: DateValue | null; end: DateValue | null }>({
  start: null,
  end: null
});

// Helper function to convert DateValue to Date for emit
const dateValueToDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  // Convert DateValue to Date using its toString method
  return new Date(dateValue.toString());
};
const selectedReason = ref<string>('all');

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns;
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: (updaterOrValue) => {
    sorting.value = typeof updaterOrValue === 'function'
      ? updaterOrValue(sorting.value)
      : updaterOrValue;
  },
  onColumnFiltersChange: (updaterOrValue) => {
    columnFilters.value = typeof updaterOrValue === 'function'
      ? updaterOrValue(columnFilters.value)
      : updaterOrValue;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
    get columnFilters() {
      return columnFilters.value;
    },
  },
});

const applyDateFilter = () => {
  emit('date-filter', dateValueToDate(dateRange.value.start), dateValueToDate(dateRange.value.end));
};

const clearDateFilter = () => {
  dateRange.value = { start: null, end: null };
  emit('date-filter', null, null);
};

watch(selectedReason, (value) => {
  emit('reason-filter', value === 'all' ? '' : value);
});

watch(searchQuery, (value) => {
  emit('search', value);
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search by product name or SKU..." class="pl-8" />
      </div>

      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" class="justify-start text-left font-normal">
            <Calendar class="mr-2 h-4 w-4" />
            {{ dateRange.start && dateRange.end
              ? `${dateRange.start.toString()} - ${dateRange.end.toString()}`
              : 'Select date range' }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <div class="p-3 space-y-3">
            <div>
              <p class="text-sm font-medium mb-2">Start Date</p>
              <CalendarComponent :model-value="dateRange.start as any" @update:model-value="dateRange.start = $event" />
            </div>
            <div>
              <p class="text-sm font-medium mb-2">End Date</p>
              <CalendarComponent :model-value="dateRange.end as any" @update:model-value="dateRange.end = $event" />
            </div>
            <div class="flex gap-2">
              <Button @click="applyDateFilter" size="sm" class="flex-1">Apply</Button>
              <Button @click="clearDateFilter" variant="outline" size="sm" class="flex-1">Clear</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Select v-model="selectedReason">
        <SelectTrigger class="w-full sm:w-[180px]">
          <Filter class="mr-2 h-4 w-4" />
          <SelectValue placeholder="Filter by reason" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Reasons</SelectItem>
          <SelectItem value="sale">Sale</SelectItem>
          <SelectItem value="purchase">Purchase</SelectItem>
          <SelectItem value="adjust">Adjustment</SelectItem>
          <SelectItem value="damage">Damage</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <TableHead v-for="header in headerGroup.headers" :key="header.id">
              <FlexRender v-if="!header.isPlaceholder" :render="header.column.columnDef.header"
                :props="header.getContext()" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows?.length">
            <TableRow v-for="row in table.getRowModel().rows" :key="row.id"
              :data-state="row.getIsSelected() && 'selected'">
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="columns.length" class="h-24 text-center">
              No stock movements found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-2">
      <div class="text-sm text-muted-foreground">
        {{ table.getFilteredRowModel().rows.length }} movement(s) total
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">
          Previous
        </Button>
        <Button variant="outline" size="sm" :disabled="!table.getCanNextPage()" @click="table.nextPage()">
          Next
        </Button>
      </div>
    </div>
  </div>
</template>