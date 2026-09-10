'use client';

import type { PayerSelectOption } from '@kit/payers/components';
import type { Database } from '@kit/supabase/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import { EnrollmentsTab } from './enrollments-tab';
import { FacilitiesTab } from './facilities-tab';
import { ProvidersTab } from './providers-tab';

type ProviderRow = Database['public']['Tables']['providers']['Row'];
type FacilityRow = Database['public']['Tables']['facilities']['Row'];
type EnrollmentRow =
  Database['public']['Tables']['organization_payer_enrollments']['Row'];

export function ProvidersPageContent({
  organizationId,
  providers,
  facilities,
  enrollments,
  payers,
}: {
  organizationId: string;
  providers: ProviderRow[];
  facilities: FacilityRow[];
  enrollments: EnrollmentRow[];
  payers: PayerSelectOption[];
}) {
  return (
    <Tabs defaultValue={'providers'}>
      <TabsList>
        <TabsTrigger value={'providers'}>Providers</TabsTrigger>
        <TabsTrigger value={'facilities'}>Facilities</TabsTrigger>
        <TabsTrigger value={'enrollments'}>Payer Enrollments</TabsTrigger>
      </TabsList>

      <TabsContent value={'providers'}>
        <ProvidersTab organizationId={organizationId} providers={providers} />
      </TabsContent>

      <TabsContent value={'facilities'}>
        <FacilitiesTab organizationId={organizationId} facilities={facilities} />
      </TabsContent>

      <TabsContent value={'enrollments'}>
        <EnrollmentsTab organizationId={organizationId} payers={payers} enrollments={enrollments} />
      </TabsContent>
    </Tabs>
  );
}
