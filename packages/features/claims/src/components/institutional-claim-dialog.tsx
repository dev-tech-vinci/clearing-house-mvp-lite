'use client';

import { useEffect, useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import type { Database } from '@kit/supabase/database';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';

import { SYNTHETIC_TYPE_OF_BILL_CODES } from '../lib/synthetic-codes';
import { CreateInstitutionalClaimSchema } from '../schema/claim.schema';
import { createInstitutionalClaimAction } from '../server/claims.actions';

type SubscriberRow = Database['public']['Tables']['subscribers']['Row'] & {
  patient: { id: string; first_name: string; last_name: string } | null;
};
type CoverageRow = Database['public']['Tables']['coverages']['Row'];
type ProviderRow = Database['public']['Tables']['providers']['Row'];
type FacilityRow = Database['public']['Tables']['facilities']['Row'];

const defaultValues = {
  subscriberId: '',
  patientId: '',
  coverageId: '',
  billingProviderId: '',
  facilityId: '',
  typeOfBill: '',
  admissionDate: '',
  dischargeDate: '',
  notes: '',
};

function providerLabel(provider: ProviderRow) {
  const name =
    provider.provider_type === 'individual'
      ? `${provider.first_name ?? ''} ${provider.last_name ?? ''}`.trim()
      : (provider.organization_name ?? '');

  return `${name} (${provider.sim_provider_id})`;
}

export function InstitutionalClaimDialog({
  organizationId,
  subscribers,
  coverages,
  providers,
  facilities,
  open,
  onOpenChange,
  onCreated,
}: {
  organizationId: string;
  subscribers: SubscriberRow[];
  coverages: CoverageRow[];
  providers: ProviderRow[];
  facilities: FacilityRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (claimId: string) => void;
}) {
  const form = useForm<z.input<typeof CreateInstitutionalClaimSchema>>({
    resolver: zodResolver(CreateInstitutionalClaimSchema),
    defaultValues: { organizationId, ...defaultValues },
  });

  useEffect(() => {
    if (open) {
      form.reset({ organizationId, ...defaultValues });
    }
  }, [open, organizationId, form]);

  const createMutation = useMutation({ mutationFn: createInstitutionalClaimAction });
  const selectedSubscriberId = form.watch('subscriberId');

  const availableCoverages = useMemo(
    () => coverages.filter((coverage) => coverage.subscriber_id === selectedSubscriberId),
    [coverages, selectedSubscriberId],
  );

  const onSubmit = (data: z.input<typeof CreateInstitutionalClaimSchema>) => {
    const promise = createMutation.mutateAsync(data as never).then((claim) => {
      onOpenChange(false);
      onCreated((claim as { id: string }).id);

      return claim;
    });

    toast.promise(() => promise, {
      loading: 'Creating claim...',
      success: 'Claim created',
      error: (error) => (error instanceof Error ? error.message : 'Could not create claim'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New institutional claim (837I)</DialogTitle>
          <DialogDescription>
            Simulation only. Supported subset: facility (type-of-bill),
            admission/discharge, revenue codes, diagnosis set. Occurrence,
            value, and condition codes are not supported in this
            simulation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              name={'subscriberId'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscriber</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);

                      const subscriber = subscribers.find((s) => s.id === value);

                      if (subscriber) {
                        form.setValue('patientId', subscriber.patient_id, {
                          shouldValidate: true,
                        });
                      }

                      form.setValue('coverageId', '', { shouldValidate: true });
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-test={'claim-subscriber-select'}>
                        <SelectValue placeholder={'Select a subscriber'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subscribers.map((subscriber) => (
                        <SelectItem key={subscriber.id} value={subscriber.id}>
                          {subscriber.first_name} {subscriber.last_name} (
                          {subscriber.sim_subscriber_id}) -- covers{' '}
                          {subscriber.patient?.first_name} {subscriber.patient?.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'coverageId'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coverage</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedSubscriberId}
                  >
                    <FormControl>
                      <SelectTrigger data-test={'claim-coverage-select'}>
                        <SelectValue placeholder={'Select a coverage'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableCoverages.map((coverage) => (
                        <SelectItem key={coverage.id} value={coverage.id}>
                          {coverage.payer_label} ({coverage.member_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'billingProviderId'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing provider</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-test={'claim-billing-provider-select'}>
                          <SelectValue placeholder={'Select a provider'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {providerLabel(provider)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'facilityId'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facility</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-test={'claim-facility-select'}>
                          <SelectValue placeholder={'Select a facility'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {facilities.map((facility) => (
                          <SelectItem key={facility.id} value={facility.id}>
                            {facility.name} ({facility.sim_facility_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name={'typeOfBill'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of bill</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-test={'claim-type-of-bill-select'}>
                        <SelectValue placeholder={'Select a type of bill'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SYNTHETIC_TYPE_OF_BILL_CODES.map((tob) => (
                        <SelectItem key={tob.code} value={tob.code}>
                          {tob.code} -- {tob.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'admissionDate'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admission date (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type={'date'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'dischargeDate'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discharge date (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type={'date'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name={'notes'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type={'submit'}
                data-test={'create-institutional-claim-submit'}
                disabled={createMutation.isPending}
              >
                Create claim
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
