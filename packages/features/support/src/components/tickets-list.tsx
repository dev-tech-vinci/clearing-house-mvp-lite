'use client';

import { useMemo } from 'react';

import Link from 'next/link';

import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/data-table';

interface TicketRow {
  id: string;
  sim_ticket_id: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string | null;
  organization: { name: string } | null;
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  open: 'secondary',
  in_progress: 'default',
  resolved: 'outline',
  closed: 'outline',
};

/**
 * Used by both /home/support (a customer's own tickets) and
 * /support/tickets (the support-side queue -- RLS already scopes which
 * rows show up: everything for support_manager, assigned/unassigned only
 * for support_agent). basePath lets each caller point rows at their own
 * detail route (a plain string, not a function -- a function prop can't
 * cross the Server Component -> Client Component boundary).
 */
export function TicketsList({
  tickets,
  basePath,
  showOrganization = false,
}: {
  tickets: TicketRow[];
  basePath: string;
  showOrganization?: boolean;
}) {
  const columns = useMemo<ColumnDef<TicketRow>[]>(
    () => [
      { accessorKey: 'sim_ticket_id', header: 'Ticket' },
      { accessorKey: 'subject', header: 'Subject' },
      ...(showOrganization
        ? [
            {
              id: 'organization',
              header: 'Organization',
              cell: ({ row }: { row: { original: TicketRow } }) =>
                row.original.organization?.name ?? '',
            } as ColumnDef<TicketRow>,
          ]
        : []),
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? 'outline'}>
            {row.original.status.replaceAll('_', ' ')}
          </Badge>
        ),
      },
      { accessorKey: 'priority', header: 'Priority' },
      {
        id: 'assigned',
        header: 'Assigned',
        cell: ({ row }) => (row.original.assigned_to ? 'Assigned' : 'Unassigned'),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button variant={'ghost'} size={'sm'} asChild>
            <Link href={`${basePath}/${row.original.id}`}>Open</Link>
          </Button>
        ),
      },
    ],
    [showOrganization, basePath],
  );

  return (
    <div data-test={'tickets-table'}>
      <DataTable columns={columns} data={tickets} />
    </div>
  );
}
