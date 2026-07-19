'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import type { Database } from '@kit/supabase/database';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/data-table';

import { deactivateCoverageAction } from '../server/coverages.actions';
import { CoverageDialog } from './coverage-dialog';

type SubscriberRow = Database['public']['Tables']['subscribers']['Row'] & {
  patient: { id: string; first_name: string; last_name: string } | null;
};
type CoverageRow = Database['public']['Tables']['coverages']['Row'] & {
  subscriber: { id: string; first_name: string; last_name: string; sim_subscriber_id: string } | null;
  patient: { id: string; first_name: string; last_name: string; sim_patient_id: string } | null;
};

export function CoveragesTab({
  organizationId,
  subscribers,
  coverages,
}: {
  organizationId: string;
  subscribers: SubscriberRow[];
  coverages: CoverageRow[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CoverageRow | undefined>(undefined);
  const router = useRouter();

  const deactivateMutation = useMutation({
    mutationFn: deactivateCoverageAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const columns = useMemo<ColumnDef<CoverageRow>[]>(
    () => [
      { accessorKey: 'member_id', header: 'Member ID' },
      { accessorKey: 'payer_label', header: 'Payer' },
      {
        id: 'patient',
        header: 'Patient',
        cell: ({ row }) =>
          row.original.patient
            ? `${row.original.patient.first_name} ${row.original.patient.last_name}`
            : '',
      },
      { accessorKey: 'coverage_type', header: 'Type' },
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
                const promise = deactivateMutation.mutateAsync({
                  coverageId: row.original.id,
                  isActive: !row.original.is_active,
                });

                toast.promise(() => promise, {
                  loading: 'Updating...',
                  success: row.original.is_active
                    ? 'Coverage deactivated'
                    : 'Coverage reactivated',
                  error: 'Could not update coverage',
                });
              }}
            >
              {row.original.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        ),
      },
    ],
    [deactivateMutation],
  );

  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex justify-end'}>
        <Button
          data-test={'add-coverage-trigger'}
          disabled={subscribers.length === 0}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          Add coverage
        </Button>
      </div>

      <div data-test={'coverages-table'}>
        <DataTable columns={columns} data={coverages} />
      </div>

      <CoverageDialog
        organizationId={organizationId}
        subscribers={subscribers}
        coverage={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
