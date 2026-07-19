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

import { CoverageFormSchema } from '../schema/coverage.schema';
import { createCoverageAction, updateCoverageAction } from '../server/coverages.actions';

type CoverageRow = Database['public']['Tables']['coverages']['Row'];
type SubscriberRow = Database['public']['Tables']['subscribers']['Row'] & {
  patient: { id: string; first_name: string; last_name: string } | null;
};

const defaultValues = {
  subscriberId: '',
  patientId: '',
  payerLabel: '',
  groupNumber: '',
  coverageType: 'primary' as const,
  effectiveDate: '',
  terminationDate: '',
};

export function CoverageDialog({
  organizationId,
  subscribers,
  coverage,
  open,
  onOpenChange,
}: {
  organizationId: string;
  subscribers: SubscriberRow[];
  coverage?: CoverageRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(coverage);

  const form = useForm({
    resolver: zodResolver(CoverageFormSchema),
    defaultValues: { organizationId, ...defaultValues },
  });

  useEffect(() => {
    if (coverage) {
      form.reset({
        organizationId,
        coverageId: coverage.id,
        subscriberId: coverage.subscriber_id,
        patientId: coverage.patient_id,
        payerLabel: coverage.payer_label,
        groupNumber: coverage.group_number ?? '',
        coverageType: coverage.coverage_type as 'primary' | 'secondary' | 'tertiary',
        effectiveDate: coverage.effective_date ?? '',
        terminationDate: coverage.termination_date ?? '',
      });
    } else {
      form.reset({ organizationId, ...defaultValues });
    }
  }, [coverage, organizationId, form]);

  const createMutation = useMutation({ mutationFn: createCoverageAction });
  const updateMutation = useMutation({ mutationFn: updateCoverageAction });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: z.input<typeof CoverageFormSchema>) => {
    const promise = (
      isEdit
        ? updateMutation.mutateAsync({
            ...data,
            coverageId: data.coverageId as string,
          } as never)
        : createMutation.mutateAsync(data as never)
    ).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: isEdit ? 'Updating coverage...' : 'Creating coverage...',
      success: isEdit ? 'Coverage updated' : 'Coverage created',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not save coverage',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit coverage' : 'Add coverage'}</DialogTitle>
          <DialogDescription>
            Simulation only -- member ID is auto-generated and obviously
            synthetic. The payer directory is added in a later phase; enter
            a label for now.
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
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={'Select a subscriber'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subscribers.map((subscriber) => (
                        <SelectItem key={subscriber.id} value={subscriber.id}>
                          {subscriber.first_name} {subscriber.last_name} (
                          {subscriber.sim_subscriber_id}) -- covers{' '}
                          {subscriber.patient?.first_name}{' '}
                          {subscriber.patient?.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'payerLabel'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payer label</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'SIM-MEDICARE-FFS'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'groupNumber'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group number (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'SIM-GRP-001'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'coverageType'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coverage type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={'primary'}>Primary</SelectItem>
                        <SelectItem value={'secondary'}>Secondary</SelectItem>
                        <SelectItem value={'tertiary'}>Tertiary</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'effectiveDate'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective date</FormLabel>
                    <FormControl>
                      <Input {...field} type={'date'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'terminationDate'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Termination date</FormLabel>
                    <FormControl>
                      <Input {...field} type={'date'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type={'submit'} disabled={isPending}>
                {isEdit ? 'Save changes' : 'Add coverage'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
