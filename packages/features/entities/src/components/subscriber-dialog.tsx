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

import { SubscriberFormSchema } from '../schema/subscriber.schema';
import {
  createSubscriberAction,
  updateSubscriberAction,
} from '../server/subscribers.actions';

type PatientRow = Database['public']['Tables']['patients']['Row'];
type SubscriberRow = Database['public']['Tables']['subscribers']['Row'];

const defaultValues = {
  patientId: '',
  relationshipToPatient: 'self' as const,
  firstName: '',
  lastName: '',
  dateOfBirth: '',
};

export function SubscriberDialog({
  organizationId,
  patients,
  subscriber,
  open,
  onOpenChange,
}: {
  organizationId: string;
  patients: PatientRow[];
  subscriber?: SubscriberRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(subscriber);

  const form = useForm({
    resolver: zodResolver(SubscriberFormSchema),
    defaultValues: { organizationId, ...defaultValues },
  });

  useEffect(() => {
    if (subscriber) {
      form.reset({
        organizationId,
        subscriberId: subscriber.id,
        patientId: subscriber.patient_id,
        relationshipToPatient: subscriber.relationship_to_patient as
          | 'self'
          | 'spouse'
          | 'child'
          | 'other',
        firstName: subscriber.first_name,
        lastName: subscriber.last_name,
        dateOfBirth: subscriber.date_of_birth ?? '',
      });
    } else {
      form.reset({ organizationId, ...defaultValues });
    }
  }, [subscriber, organizationId, form]);

  const createMutation = useMutation({ mutationFn: createSubscriberAction });
  const updateMutation = useMutation({ mutationFn: updateSubscriberAction });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: z.input<typeof SubscriberFormSchema>) => {
    const promise = (
      isEdit
        ? updateMutation.mutateAsync({
            ...data,
            subscriberId: data.subscriberId as string,
          } as never)
        : createMutation.mutateAsync(data as never)
    ).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: isEdit ? 'Updating subscriber...' : 'Creating subscriber...',
      success: isEdit ? 'Subscriber updated' : 'Subscriber created',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not save subscriber',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit subscriber' : 'Add subscriber'}
          </DialogTitle>
          <DialogDescription>
            Simulation only. A subscriber is the insurance policy holder for
            a patient -- often the patient themselves.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              name={'patientId'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={'Select a patient'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.first_name} {patient.last_name} (
                          {patient.sim_patient_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'relationshipToPatient'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship to patient</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={'self'}>Self</SelectItem>
                      <SelectItem value={'spouse'}>Spouse</SelectItem>
                      <SelectItem value={'child'}>Child</SelectItem>
                      <SelectItem value={'other'}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'firstName'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'Patty'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'lastName'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'Testperson'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name={'dateOfBirth'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of birth (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type={'date'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type={'submit'} disabled={isPending}>
                {isEdit ? 'Save changes' : 'Add subscriber'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
