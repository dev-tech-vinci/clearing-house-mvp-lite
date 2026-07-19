'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ColumnDef } from '@tanstack/react-table';

import type { Database } from '@kit/supabase/database';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/data-table';

import { InstitutionalClaimDialog } from './institutional-claim-dialog';
import { ProfessionalClaimDialog } from './professional-claim-dialog';

type ClaimRow = Database['public']['Tables']['claims']['Row'] & {
  patient: { id: string; first_name: string; last_name: string } | null;
  coverage: { id: string; payer_label: string } | null;
};
type SubscriberRow = Database['public']['Tables']['subscribers']['Row'] & {
  patient: { id: string; first_name: string; last_name: string } | null;
};
type CoverageRow = Database['public']['Tables']['coverages']['Row'];
type ProviderRow = Database['public']['Tables']['providers']['Row'];
type FacilityRow = Database['public']['Tables']['facilities']['Row'];

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  draft: 'outline',
  validation_failed: 'destructive',
  validated: 'secondary',
  approved: 'default',
};

export function ClaimsList({
  organizationId,
  claims,
  subscribers,
  coverages,
  providers,
  facilities,
  canCreateEdit,
}: {
  organizationId: string;
  claims: ClaimRow[];
  subscribers: SubscriberRow[];
  coverages: CoverageRow[];
  providers: ProviderRow[];
  facilities: FacilityRow[];
  canCreateEdit: boolean;
}) {
  const [professionalOpen, setProfessionalOpen] = useState(false);
  const [institutionalOpen, setInstitutionalOpen] = useState(false);
  const router = useRouter();

  const columns = useMemo<ColumnDef<ClaimRow>[]>(
    () => [
      { accessorKey: 'sim_claim_id', header: 'Claim ID' },
      {
        id: 'claim_type',
        header: 'Type',
        cell: ({ row }) => (row.original.claim_type === 'professional' ? '837P' : '837I'),
      },
      {
        id: 'patient',
        header: 'Patient',
        cell: ({ row }) =>
          row.original.patient
            ? `${row.original.patient.first_name} ${row.original.patient.last_name}`
            : '',
      },
      {
        id: 'payer',
        header: 'Payer',
        cell: ({ row }) => row.original.coverage?.payer_label ?? '',
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status] ?? 'outline'}>
            {row.original.status.replace('_', ' ')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className={'flex justify-end'}>
            <Button variant={'ghost'} size={'sm'} asChild>
              <Link href={`/home/claims/${row.original.id}`}>View</Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className={'flex flex-col space-y-4'}>
      {canCreateEdit && (
        <div className={'flex justify-end gap-x-2'}>
          <Button
            variant={'outline'}
            data-test={'new-professional-claim-trigger'}
            onClick={() => setProfessionalOpen(true)}
          >
            New Professional Claim
          </Button>
          <Button
            data-test={'new-institutional-claim-trigger'}
            onClick={() => setInstitutionalOpen(true)}
          >
            New Institutional Claim
          </Button>
        </div>
      )}

      <div data-test={'claims-table'}>
        <DataTable columns={columns} data={claims} />
      </div>

      <ProfessionalClaimDialog
        organizationId={organizationId}
        subscribers={subscribers}
        coverages={coverages}
        providers={providers}
        open={professionalOpen}
        onOpenChange={setProfessionalOpen}
        onCreated={(claimId) => router.push(`/home/claims/${claimId}`)}
      />

      <InstitutionalClaimDialog
        organizationId={organizationId}
        subscribers={subscribers}
        coverages={coverages}
        providers={providers}
        facilities={facilities}
        open={institutionalOpen}
        onOpenChange={setInstitutionalOpen}
        onCreated={(claimId) => router.push(`/home/claims/${claimId}`)}
      />
    </div>
  );
}
