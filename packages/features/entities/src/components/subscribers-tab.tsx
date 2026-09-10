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

import { deactivateSubscriberAction } from '../server/subscribers.actions';
import { SubscriberDialog } from './subscriber-dialog';

type PatientRow = Database['public']['Tables']['patients']['Row'];
type SubscriberRow = Database['public']['Tables']['subscribers']['Row'] & {
  patient: { id: string; first_name: string; last_name: string; sim_patient_id: string } | null;
};

export function SubscribersTab({
  organizationId,
  patients,
  subscribers,
}: {
  organizationId: string;
  patients: PatientRow[];
  subscribers: SubscriberRow[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriberRow | undefined>(undefined);
  const router = useRouter();

  const deactivateMutation = useMutation({
    mutationFn: deactivateSubscriberAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const columns = useMemo<ColumnDef<SubscriberRow>[]>(
    () => [
      { accessorKey: 'sim_subscriber_id', header: 'ID' },
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
      },
      { accessorKey: 'relationship_to_patient', header: 'Relationship' },
      {
        id: 'patient',
        header: 'Patient',
        cell: ({ row }) =>
          row.original.patient
            ? `${row.original.patient.first_name} ${row.original.patient.last_name}`
            : '',
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
                  subscriberId: row.original.id,
                  isActive: !row.original.is_active,
                });

                toast.promise(() => promise, {
                  loading: 'Updating...',
                  success: row.original.is_active
                    ? 'Subscriber deactivated'
                    : 'Subscriber reactivated',
                  error: 'Could not update subscriber',
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
          data-test={'add-subscriber-trigger'}
          disabled={patients.length === 0}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          Add subscriber
        </Button>
      </div>

      <div data-test={'subscribers-table'}>
        <DataTable columns={columns} data={subscribers} />
      </div>

      <SubscriberDialog
        organizationId={organizationId}
        patients={patients}
        subscriber={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
