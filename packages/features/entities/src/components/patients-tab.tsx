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

import { deactivatePatientAction } from '../server/patients.actions';
import { PatientDialog } from './patient-dialog';

type PatientRow = Database['public']['Tables']['patients']['Row'];

export function PatientsTab({
  organizationId,
  patients,
}: {
  organizationId: string;
  patients: PatientRow[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PatientRow | undefined>(undefined);
  const router = useRouter();

  const deactivateMutation = useMutation({
    mutationFn: deactivatePatientAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const columns = useMemo<ColumnDef<PatientRow>[]>(
    () => [
      { accessorKey: 'sim_patient_id', header: 'ID' },
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
      },
      { accessorKey: 'date_of_birth', header: 'Date of birth' },
      { accessorKey: 'gender', header: 'Gender' },
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
                  patientId: row.original.id,
                  isActive: !row.original.is_active,
                });

                toast.promise(() => promise, {
                  loading: 'Updating...',
                  success: row.original.is_active
                    ? 'Patient deactivated'
                    : 'Patient reactivated',
                  error: 'Could not update patient',
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
          data-test={'add-patient-trigger'}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          Add patient
        </Button>
      </div>

      <div data-test={'patients-table'}>
        <DataTable columns={columns} data={patients} />
      </div>

      <PatientDialog
        organizationId={organizationId}
        patient={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
