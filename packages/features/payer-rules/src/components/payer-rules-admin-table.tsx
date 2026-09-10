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
import { ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

import type { PayerSelectOption } from '@kit/payers/components';
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

import { RULE_CATEGORIES, RULE_CATEGORY_LABELS } from '../schema/payer-rule.schema';
import { setRuleActiveAction } from '../server/payer-rules.actions';
import { CreateRuleDialog } from './rule-dialog';
import { AddRuleVersionDialog } from './rule-version-dialog';
import { RuleVersionHistoryDialog } from './rule-version-history-dialog';

type RuleVersionRow = Database['public']['Tables']['payer_rule_versions']['Row'];
type RuleRow = Database['public']['Tables']['payer_rules']['Row'] & {
  payer: { id: string; sim_payer_id: string; display_name: string } | null;
  versions: RuleVersionRow[];
};

function latestVersionOf(rule: RuleRow): RuleVersionRow | undefined {
  return [...rule.versions].sort((a, b) => b.version_number - a.version_number)[0];
}

export function PayerRulesAdminTable({
  rules,
  payers,
}: {
  rules: RuleRow[];
  payers: PayerSelectOption[];
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'rule_code', desc: false }]);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionDialogRule, setVersionDialogRule] = useState<RuleRow | undefined>(undefined);
  const [historyDialogRule, setHistoryDialogRule] = useState<RuleRow | undefined>(undefined);
  const router = useRouter();

  const activeMutation = useMutation({
    mutationFn: setRuleActiveAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) {
        return false;
      }

      if (search) {
        const haystack = `${r.rule_code} ${r.payer?.display_name ?? ''}`.toLowerCase();

        if (!haystack.includes(search.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [rules, search, categoryFilter]);

  const columns = useMemo<ColumnDef<RuleRow>[]>(
    () => [
      { accessorKey: 'rule_code', header: 'Rule code' },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) =>
          RULE_CATEGORY_LABELS[row.original.category as (typeof RULE_CATEGORIES)[number]] ??
          row.original.category,
      },
      {
        id: 'payer',
        header: 'Payer',
        cell: ({ row }) => row.original.payer?.display_name ?? 'All payers',
      },
      {
        id: 'latest',
        header: 'Latest version',
        cell: ({ row }) => {
          const latest = latestVersionOf(row.original);

          if (!latest) {
            return '—';
          }

          return (
            <div className={'flex items-center gap-x-2'}>
              <span>v{latest.version_number}</span>
              <Badge variant={latest.rejection_or_denial === 'denial' ? 'destructive' : 'outline'}>
                {latest.rejection_or_denial}
              </Badge>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'default' : 'outline'}>
            {row.original.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className={'flex justify-end gap-x-2'}>
            <Button variant={'ghost'} size={'sm'} onClick={() => setHistoryDialogRule(row.original)}>
              History
            </Button>
            <Button variant={'ghost'} size={'sm'} onClick={() => setVersionDialogRule(row.original)}>
              Edit
            </Button>
            <Button
              variant={'ghost'}
              size={'sm'}
              onClick={() => {
                const promise = activeMutation.mutateAsync({
                  payerRuleId: row.original.id,
                  isActive: !row.original.is_active,
                });

                toast.promise(() => promise, {
                  loading: 'Updating...',
                  success: row.original.is_active ? 'Rule deactivated' : 'Rule reactivated',
                  error: 'Could not update rule',
                });
              }}
            >
              {row.original.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        ),
      },
    ],
    [activeMutation],
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
      <div className={'flex flex-wrap items-center justify-between gap-2'}>
        <div className={'flex flex-wrap items-center gap-2'}>
          <Input
            data-test={'payer-rules-search'}
            placeholder={'Search rules...'}
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
              {RULE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {RULE_CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button data-test={'add-rule-trigger'} onClick={() => setCreateOpen(true)}>
          Add rule
        </Button>
      </div>

      <div className={'rounded-lg border'} data-test={'payer-rules-admin-table'}>
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
                  No rules match your search/filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateRuleDialog payers={payers} open={createOpen} onOpenChange={setCreateOpen} />

      {versionDialogRule && (
        <AddRuleVersionDialog
          ruleCode={versionDialogRule.rule_code}
          payerRuleId={versionDialogRule.id}
          latestVersion={latestVersionOf(versionDialogRule)}
          open={Boolean(versionDialogRule)}
          onOpenChange={(open) => !open && setVersionDialogRule(undefined)}
        />
      )}

      {historyDialogRule && (
        <RuleVersionHistoryDialog
          ruleCode={historyDialogRule.rule_code}
          versions={historyDialogRule.versions}
          open={Boolean(historyDialogRule)}
          onOpenChange={(open) => !open && setHistoryDialogRule(undefined)}
        />
      )}
    </div>
  );
}
