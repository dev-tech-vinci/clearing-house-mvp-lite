'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { useMutation } from '@tanstack/react-query';
import { ArrowUpDown, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type { Database } from '@kit/supabase/database';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
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

import { toCsv } from '../lib/csv';
import { PAYER_CATEGORIES, PAYER_CATEGORY_LABELS } from '../schema/payer.schema';
import {
  setPayerActiveAction,
  softDeletePayerAction,
} from '../server/payers.actions';
import { PayerCsvImportDialog } from './payer-csv-import-dialog';
import { PayerDialog } from './payer-dialog';

type PayerRow = Database['public']['Tables']['payers']['Row'];

export function PayersAdminTable({ payers }: { payers: PayerRow[] }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'display_name', desc: false }]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<PayerRow | undefined>(undefined);
  const router = useRouter();

  const activeMutation = useMutation({
    mutationFn: setPayerActiveAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });
  const deleteMutation = useMutation({
    mutationFn: softDeletePayerAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const filtered = useMemo(() => {
    return payers.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }

      if (search) {
        const haystack = `${p.sim_payer_id} ${p.display_name} ${p.legal_name ?? ''}`.toLowerCase();

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
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className={'flex gap-x-1'}>
            <Badge variant={row.original.is_active ? 'default' : 'outline'}>
              {row.original.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {row.original.deleted_at && <Badge variant={'outline'}>Deleted</Badge>}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className={'flex justify-end gap-x-2'}>
            <Button
              variant={'ghost'}
              size={'sm'}
              onClick={() => {
                setEditing(row.original);
                setDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              variant={'ghost'}
              size={'sm'}
              onClick={() => {
                const promise = activeMutation.mutateAsync({
                  payerId: row.original.id,
                  isActive: !row.original.is_active,
                });

                toast.promise(() => promise, {
                  loading: 'Updating...',
                  success: row.original.is_active ? 'Payer deactivated' : 'Payer reactivated',
                  error: 'Could not update payer',
                });
              }}
            >
              {row.original.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
            {!row.original.deleted_at && (
              <Button
                variant={'ghost'}
                size={'sm'}
                onClick={() => {
                  const promise = deleteMutation.mutateAsync({ payerId: row.original.id });

                  toast.promise(() => promise, {
                    loading: 'Deleting...',
                    success: 'Payer soft-deleted',
                    error: 'Could not delete payer',
                  });
                }}
              >
                Delete
              </Button>
            )}
          </div>
        ),
      },
    ],
    [activeMutation, deleteMutation],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const onExport = () => {
    const header = [
      'sim_payer_id',
      'display_name',
      'legal_name',
      'category',
      'scope',
      'state',
      'network_name',
      'enrollment_required',
      'test_production',
      'is_active',
    ];

    const rows = payers.map((p) => [
      p.sim_payer_id,
      p.display_name,
      p.legal_name,
      p.category,
      p.scope,
      p.state,
      p.network_name,
      p.enrollment_required,
      p.test_production,
      p.is_active,
    ]);

    const blob = new Blob([toCsv(header, rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'sim-payer-directory.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex flex-wrap items-center justify-between gap-2'}>
        <div className={'flex flex-wrap items-center gap-2'}>
          <Input
            data-test={'payers-search'}
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

        <div className={'flex gap-x-2'}>
          <Button variant={'outline'} onClick={onExport}>
            <Download className={'mr-2 h-4 w-4'} />
            Export CSV
          </Button>
          <Button variant={'outline'} onClick={() => setImportOpen(true)}>
            <Upload className={'mr-2 h-4 w-4'} />
            Import CSV
          </Button>
          <Button
            data-test={'add-payer-trigger'}
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            Add payer
          </Button>
        </div>
      </div>

      <div className={'rounded-lg border'} data-test={'payers-admin-table'}>
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

      <PayerDialog payer={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
      <PayerCsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
