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
import { Calendar, Filter } from 'lucide-vue-next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  (e: 'payment-filter', paymentType: string): void;
  (e: 'type-filter', saleType: string): void;
  // ✅ FIX: emit view-sale directly instead of dispatching on window
  (e: 'view-sale', sale: any): void;
}>();

const sorting = ref<SortingState>([]);
const columnFilters = ref<ColumnFiltersState>([]);
const dateRange = ref<{ start: DateValue | null; end: DateValue | null }>({
  start: null,
  end: null,
});
const selectedPayment = ref<string>('all');
const selectedType = ref<string>('all');



const dateValueToDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  return new Date(dateValue.toString());
};

// ✅ FIX: columns need access to emit — pass it via provide so cell renderers can use it
provide('view-sale-emit', (sale: any) => emit('view-sale', sale));

const table = useVueTable({
  get data() { return props.data; },
  get columns() { return props.columns; },
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
    get sorting() { return sorting.value; },
    get columnFilters() { return columnFilters.value; },
  },
});

const applyDateFilter = () => {
  emit('date-filter', dateValueToDate(dateRange.value.start), dateValueToDate(dateRange.value.end));
};

const clearDateFilter = () => {
  dateRange.value = { start: null, end: null };
  emit('date-filter', null, null);
};

watch(selectedPayment, (value) => {
  emit('payment-filter', value === 'all' ? '' : value);
});

watch(selectedType, (value) => {
  emit('type-filter', value === 'all' ? '' : value);
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row gap-2">
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="outline" class="justify-start text-left font-normal">
            <Calendar class="mr-2 h-4 w-4" />
            {{ dateRange.start && dateRange.end
              ? `${dateValueToDate(dateRange.start)?.toLocaleDateString()} - ${dateValueToDate(dateRange.end)?.toLocaleDateString()}`
              : 'Select date range' }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <div class="p-3 space-y-3">
            <div>
              <p class="text-sm font-medium mb-2">Start Date</p>
              <CalendarComponent v-model="dateRange.start as any" />
            </div>
            <div>
              <p class="text-sm font-medium mb-2">End Date</p>
              <CalendarComponent v-model="dateRange.end as any" />
            </div>
            <div class="flex gap-2">
              <Button @click="applyDateFilter" size="sm" class="flex-1">Apply</Button>
              <Button @click="clearDateFilter" variant="outline" size="sm" class="flex-1">Clear</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Select v-model="selectedPayment">
        <SelectTrigger class="w-full sm:w-[180px]">
          <Filter class="mr-2 h-4 w-4" />
          <SelectValue placeholder="Payment type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Payments</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="card">Card</SelectItem>
          <SelectItem value="mobile">Mobile</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="selectedType">
        <SelectTrigger class="w-full sm:w-[180px]">
          <Filter class="mr-2 h-4 w-4" />
          <SelectValue placeholder="Sale type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="retail">Retail</SelectItem>
          <SelectItem value="wholesale">Wholesale</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <TableHead v-for="header in headerGroup.headers" :key="header.id">
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
            <TableCell :colspan="columns.length" class="h-24 text-center">
              No sales found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex flex-col sm:flex-row items-center justify-between gap-2 px-2">
      <div class="text-sm text-muted-foreground">
        {{ table.getFilteredRowModel().rows.length }} sale(s) total
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          Previous
        </Button>
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