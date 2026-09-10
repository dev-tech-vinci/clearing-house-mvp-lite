'use client';

import { useMemo } from 'react';

import Link from 'next/link';

import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/data-table';

import { MatchEftButton } from './match-eft-button';

interface RemittanceRow {
  id: string;
  claim_id: string;
  sim_remittance_id: string;
  outcome: string;
  status: string;
  total_paid_amount: number;
  claim: { sim_claim_id: string; claim_type: string } | null;
  payer: { sim_payer_id: string; display_name: string } | null;
  eft_traces: { id: string; eft_trace_number: string; amount: number } | null;
  payment_matches: { id: string; matched_amount: number }[];
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  paid: 'secondary',
  denied: 'destructive',
  eft_matched: 'secondary',
  posted: 'default',
};

export function RemittancesList({
  remittances,
  canPostPayment,
}: {
  remittances: RemittanceRow[];
  canPostPayment: boolean;
}) {
  const columns = useMemo<ColumnDef<RemittanceRow>[]>(
    () => [
      { accessorKey: 'sim_remittance_id', header: 'Remittance ID' },
      {
        id: 'claim',
        header: 'Claim',
        cell: ({ row }) => row.original.claim?.sim_claim_id ?? '',
      },
      {
        id: 'payer',
        header: 'Payer',
        cell: ({ row }) => row.original.payer?.display_name ?? '',
      },
      {
        id: 'outcome',
        header: 'Outcome',
        cell: ({ row }) => (
          <Badge variant={row.original.outcome === 'denied' ? 'destructive' : 'secondary'}>
            {row.original.outcome}
          </Badge>
        ),
      },
      {
        id: 'paid_amount',
        header: 'Paid amount',
        cell: ({ row }) => `$${Number(row.original.total_paid_amount).toFixed(2)}`,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? 'outline'}>
            {row.original.status.replaceAll('_', ' ')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className={'flex justify-end gap-x-2'}>
            {row.original.eft_traces !== null && row.original.payment_matches.length === 0 && (
              <MatchEftButton
                remittanceId={row.original.id}
                canPostPayment={canPostPayment}
                remittanceStatus={row.original.status}
              />
            )}
            <Button variant={'ghost'} size={'sm'} asChild>
              <Link href={`/home/claims/${row.original.claim_id}`}>Claim</Link>
            </Button>
          </div>
        ),
      },
    ],
    [canPostPayment],
  );

  return (
    <div data-test={'remittances-table'}>
      <DataTable columns={columns} data={remittances} />
    </div>
  );
}
