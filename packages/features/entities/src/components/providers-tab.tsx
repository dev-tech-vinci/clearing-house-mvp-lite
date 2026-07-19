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

import { deactivateProviderAction } from '../server/providers.actions';
import { ProviderDialog } from './provider-dialog';

type ProviderRow = Database['public']['Tables']['providers']['Row'];

export function ProvidersTab({
  organizationId,
  providers,
}: {
  organizationId: string;
  providers: ProviderRow[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | undefined>(undefined);
  const router = useRouter();

  const deactivateMutation = useMutation({
    mutationFn: deactivateProviderAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const columns = useMemo<ColumnDef<ProviderRow>[]>(
    () => [
      { accessorKey: 'sim_provider_id', header: 'ID' },
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) =>
          row.original.provider_type === 'individual'
            ? `${row.original.first_name ?? ''} ${row.original.last_name ?? ''}`.trim()
            : row.original.organization_name,
      },
      { accessorKey: 'npi', header: 'NPI' },
      { accessorKey: 'provider_type', header: 'Type' },
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
                  providerId: row.original.id,
                  isActive: !row.original.is_active,
                });

                toast.promise(() => promise, {
                  loading: 'Updating...',
                  success: row.original.is_active
                    ? 'Provider deactivated'
                    : 'Provider reactivated',
                  error: 'Could not update provider',
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
          data-test={'add-provider-trigger'}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          Add provider
        </Button>
      </div>

      <div data-test={'providers-table'}>
        <DataTable columns={columns} data={providers} />
      </div>

      <ProviderDialog
        organizationId={organizationId}
        provider={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
