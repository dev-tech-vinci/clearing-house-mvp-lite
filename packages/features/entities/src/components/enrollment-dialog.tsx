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
import { Textarea } from '@kit/ui/textarea';

import { EnrollmentFormSchema } from '../schema/payer-enrollment.schema';
import {
  createEnrollmentAction,
  updateEnrollmentAction,
} from '../server/enrollments.actions';

type EnrollmentRow =
  Database['public']['Tables']['organization_payer_enrollments']['Row'];

const defaultValues = {
  payerLabel: '',
  status: 'pending' as const,
  effectiveDate: '',
  terminationDate: '',
  notes: '',
};

export function EnrollmentDialog({
  organizationId,
  enrollment,
  open,
  onOpenChange,
}: {
  organizationId: string;
  enrollment?: EnrollmentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(enrollment);

  const form = useForm({
    resolver: zodResolver(EnrollmentFormSchema),
    defaultValues: { organizationId, ...defaultValues },
  });

  useEffect(() => {
    if (enrollment) {
      form.reset({
        organizationId,
        enrollmentId: enrollment.id,
        payerLabel: enrollment.payer_label,
        status: enrollment.status as 'pending' | 'active' | 'inactive',
        effectiveDate: enrollment.effective_date ?? '',
        terminationDate: enrollment.termination_date ?? '',
        notes: enrollment.notes ?? '',
      });
    } else {
      form.reset({ organizationId, ...defaultValues });
    }
  }, [enrollment, organizationId, form]);

  const createMutation = useMutation({ mutationFn: createEnrollmentAction });
  const updateMutation = useMutation({ mutationFn: updateEnrollmentAction });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: z.input<typeof EnrollmentFormSchema>) => {
    const promise = (
      isEdit
        ? updateMutation.mutateAsync({
            ...data,
            enrollmentId: data.enrollmentId as string,
          } as never)
        : createMutation.mutateAsync(data as never)
    ).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: isEdit ? 'Updating enrollment...' : 'Creating enrollment...',
      success: isEdit ? 'Enrollment updated' : 'Enrollment created',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not save enrollment',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit payer enrollment' : 'Add payer enrollment'}
          </DialogTitle>
          <DialogDescription>
            Simulation data only. The payer directory is added in a later
            phase -- for now, enter a label describing the simulated payer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
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

            <FormField
              name={'status'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={'pending'}>Pending</SelectItem>
                      <SelectItem value={'active'}>Active</SelectItem>
                      <SelectItem value={'inactive'}>Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              <Button type={'submit'} disabled={isPending}>
                {isEdit ? 'Save changes' : 'Add enrollment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
