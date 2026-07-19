'use client';

import { useMemo, useState } from 'react';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

import type { Database } from '@kit/supabase/database';
import { Badge } from '@kit/ui/badge';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { PAYER_CATEGORIES, PAYER_CATEGORY_LABELS } from '../schema/payer.schema';

type PayerRow = Database['public']['Tables']['payers']['Row'];

/**
 * Read-only, search/filter/sort payer directory for org users
 * (/home/payers). No add/edit/deactivate actions -- those require
 * platform_super_admin and live under /admin/payers.
 */
export function PayersDirectory({ payers }: { payers: PayerRow[] }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'display_name', desc: false }]);

  const filtered = useMemo(() => {
    return payers.filter((p) => {
      if (!p.is_active) {
        return false;
      }

      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }

      if (search) {
        const haystack = `${p.sim_payer_id} ${p.display_name}`.toLowerCase();

        if (!haystack.includes(search.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [payers, search, categoryFilter]);

  const columns = useMemo<ColumnDef<PayerRow>[]>(
    () => [
      { accessorKey: 'sim_payer_id', header: 'ID' },
      { accessorKey: 'display_name', header: 'Name' },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) =>
          PAYER_CATEGORY_LABELS[row.original.category as (typeof PAYER_CATEGORIES)[number]] ??
          row.original.category,
      },
      { accessorKey: 'scope', header: 'Scope' },
      { accessorKey: 'network_name', header: 'Network' },
      {
        id: 'enrollment',
        header: 'Enrollment',
        cell: ({ row }) => (
          <Badge variant={row.original.enrollment_required ? 'default' : 'outline'}>
            {row.original.enrollment_required ? 'Required' : 'Not required'}
          </Badge>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={'flex flex-col space-y-4'}>
      <p className={'text-muted-foreground text-sm'}>
        Simulation data only -- ten clearly-simulated payer profiles. Never
        real payer connectivity.
      </p>

      <div className={'flex flex-wrap items-center gap-2'}>
        <Input
          data-test={'payers-directory-search'}
          placeholder={'Search payers...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={'w-64'}
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className={'w-56'}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={'all'}>All categories</SelectItem>
            {PAYER_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {PAYER_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={'rounded-lg border'} data-test={'payers-directory-table'}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type={'button'}
                        className={'flex items-center gap-x-1'}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className={'h-3 w-3'} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className={'text-muted-foreground text-center'}>
                  No payers match your search/filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
