'use client';

import type { Database } from '@kit/supabase/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import { CoveragesTab } from './coverages-tab';
import { PatientsTab } from './patients-tab';
import { SubscribersTab } from './subscribers-tab';

type PatientRow = Database['public']['Tables']['patients']['Row'];
type SubscriberRow = Database['public']['Tables']['subscribers']['Row'] & {
  patient: { id: string; first_name: string; last_name: string; sim_patient_id: string } | null;
};
type CoverageRow = Database['public']['Tables']['coverages']['Row'] & {
  subscriber: { id: string; first_name: string; last_name: string; sim_subscriber_id: string } | null;
  patient: { id: string; first_name: string; last_name: string; sim_patient_id: string } | null;
};

export function PatientsPageContent({
  organizationId,
  patients,
  subscribers,
  coverages,
}: {
  organizationId: string;
  patients: PatientRow[];
  subscribers: SubscriberRow[];
  coverages: CoverageRow[];
}) {
  return (
    <Tabs defaultValue={'patients'}>
      <TabsList>
        <TabsTrigger value={'patients'}>Patients</TabsTrigger>
        <TabsTrigger value={'subscribers'}>Subscribers</TabsTrigger>
        <TabsTrigger value={'coverages'}>Coverages</TabsTrigger>
      </TabsList>

      <TabsContent value={'patients'}>
        <PatientsTab organizationId={organizationId} patients={patients} />
      </TabsContent>

      <TabsContent value={'subscribers'}>
        <SubscribersTab
          organizationId={organizationId}
          patients={patients}
          subscribers={subscribers}
        />
      </TabsContent>

      <TabsContent value={'coverages'}>
        <CoveragesTab
          organizationId={organizationId}
          subscribers={subscribers}
          coverages={coverages}
        />
      </TabsContent>
    </Tabs>
  );
}
