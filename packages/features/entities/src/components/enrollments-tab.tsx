'use client';

import { useMemo, useState } from 'react';

import type { ColumnDef } from '@tanstack/react-table';

import type { PayerSelectOption } from '@kit/payers/components';
import type { Database } from '@kit/supabase/database';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/data-table';

import { EnrollmentDialog } from './enrollment-dialog';

type EnrollmentRow =
  Database['public']['Tables']['organization_payer_enrollments']['Row'];

export function EnrollmentsTab({
  organizationId,
  payers,
  enrollments,
}: {
  organizationId: string;
  payers: PayerSelectOption[];
  enrollments: EnrollmentRow[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EnrollmentRow | undefined>(undefined);

  const columns = useMemo<ColumnDef<EnrollmentRow>[]>(
    () => [
      { accessorKey: 'payer_label', header: 'Payer' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === 'active' ? 'default' : 'outline'}
          >
            {row.original.status}
          </Badge>
        ),
      },
      { accessorKey: 'effective_date', header: 'Effective' },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className={'flex justify-end'}>
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
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex justify-end'}>
        <Button
          data-test={'add-enrollment-trigger'}
          disabled={payers.length === 0}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          Add payer enrollment
        </Button>
      </div>

      <div data-test={'enrollments-table'}>
        <DataTable columns={columns} data={enrollments} />
      </div>

      <EnrollmentDialog
        organizationId={organizationId}
        payers={payers}
        enrollment={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
