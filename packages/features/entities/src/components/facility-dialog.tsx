'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

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

import {
  FacilityFormSchema,
} from '../schema/facility.schema';
import {
  createFacilityAction,
  updateFacilityAction,
} from '../server/facilities.actions';

type FacilityRow = Database['public']['Tables']['facilities']['Row'];

const defaultValues = {
  name: '',
  facilityType: 'outpatient_clinic' as const,
  npi: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
};

const FACILITY_TYPE_OPTIONS = [
  { value: 'outpatient_clinic', label: 'Outpatient Clinic' },
  { value: 'inpatient_hospital', label: 'Inpatient Hospital' },
  { value: 'residential', label: 'Residential' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'other', label: 'Other' },
];

export function FacilityDialog({
  organizationId,
  facility,
  open,
  onOpenChange,
}: {
  organizationId: string;
  facility?: FacilityRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(facility);

  const form = useForm({
    resolver: zodResolver(FacilityFormSchema),
    defaultValues: { organizationId, ...defaultValues },
  });

  useEffect(() => {
    if (facility) {
      form.reset({
        organizationId,
        facilityId: facility.id,
        name: facility.name,
        facilityType: facility.facility_type as
          | 'outpatient_clinic'
          | 'inpatient_hospital'
          | 'residential'
          | 'telehealth'
          | 'other',
        npi: facility.npi ?? '',
        addressLine1: facility.address_line1 ?? '',
        addressLine2: facility.address_line2 ?? '',
        city: facility.city ?? '',
        state: facility.state ?? '',
        postalCode: facility.postal_code ?? '',
      });
    } else {
      form.reset({ organizationId, ...defaultValues });
    }
  }, [facility, organizationId, form]);

  const createMutation = useMutation({ mutationFn: createFacilityAction });
  const updateMutation = useMutation({ mutationFn: updateFacilityAction });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: z.input<typeof FacilityFormSchema>) => {
    const promise = (
      isEdit
        ? updateMutation.mutateAsync({
            ...data,
            facilityId: data.facilityId as string,
          } as never)
        : createMutation.mutateAsync(data as never)
    ).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: isEdit ? 'Updating facility...' : 'Creating facility...',
      success: isEdit ? 'Facility updated' : 'Facility created',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not save facility',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit facility' : 'Add facility'}</DialogTitle>
          <DialogDescription>Simulation data only.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              name={'name'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facility name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'SIM Behavioral Health Clinic'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'facilityType'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facility type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FACILITY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'npi'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NPI (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'e.g. 1234567893'} maxLength={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'addressLine1'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'123 Simulation Way'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={'grid grid-cols-3 gap-4'}>
              <FormField
                name={'city'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'Springfield'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'state'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'CA'} maxLength={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'postalCode'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'00000'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type={'submit'} disabled={isPending}>
                {isEdit ? 'Save changes' : 'Add facility'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
