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

import { deactivateFacilityAction } from '../server/facilities.actions';
import { FacilityDialog } from './facility-dialog';

type FacilityRow = Database['public']['Tables']['facilities']['Row'];

export function FacilitiesTab({
  organizationId,
  facilities,
}: {
  organizationId: string;
  facilities: FacilityRow[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityRow | undefined>(undefined);
  const router = useRouter();

  const deactivateMutation = useMutation({
    mutationFn: deactivateFacilityAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const columns = useMemo<ColumnDef<FacilityRow>[]>(
    () => [
      { accessorKey: 'sim_facility_id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'facility_type', header: 'Type' },
      {
        id: 'location',
        header: 'Location',
        cell: ({ row }) =>
          [row.original.city, row.original.state].filter(Boolean).join(', '),
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
                  facilityId: row.original.id,
                  isActive: !row.original.is_active,
                });

                toast.promise(() => promise, {
                  loading: 'Updating...',
                  success: row.original.is_active
                    ? 'Facility deactivated'
                    : 'Facility reactivated',
                  error: 'Could not update facility',
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
          data-test={'add-facility-trigger'}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          Add facility
        </Button>
      </div>

      <div data-test={'facilities-table'}>
        <DataTable columns={columns} data={facilities} />
      </div>

      <FacilityDialog
        organizationId={organizationId}
        facility={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
