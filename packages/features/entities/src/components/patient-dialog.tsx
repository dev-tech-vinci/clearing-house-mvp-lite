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

import { PatientFormSchema } from '../schema/patient.schema';
import { createPatientAction, updatePatientAction } from '../server/patients.actions';

type PatientRow = Database['public']['Tables']['patients']['Row'];

const defaultValues = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'unknown' as const,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
};

export function PatientDialog({
  organizationId,
  patient,
  open,
  onOpenChange,
}: {
  organizationId: string;
  patient?: PatientRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(patient);

  const form = useForm({
    resolver: zodResolver(PatientFormSchema),
    defaultValues: { organizationId, ...defaultValues },
  });

  useEffect(() => {
    if (patient) {
      form.reset({
        organizationId,
        patientId: patient.id,
        firstName: patient.first_name,
        lastName: patient.last_name,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender as 'female' | 'male' | 'other' | 'unknown',
        addressLine1: patient.address_line1 ?? '',
        addressLine2: patient.address_line2 ?? '',
        city: patient.city ?? '',
        state: patient.state ?? '',
        postalCode: patient.postal_code ?? '',
      });
    } else {
      form.reset({ organizationId, ...defaultValues });
    }
  }, [patient, organizationId, form]);

  const createMutation = useMutation({ mutationFn: createPatientAction });
  const updateMutation = useMutation({ mutationFn: updatePatientAction });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: z.input<typeof PatientFormSchema>) => {
    const promise = (
      isEdit
        ? updateMutation.mutateAsync({
            ...data,
            patientId: data.patientId as string,
          } as never)
        : createMutation.mutateAsync(data as never)
    ).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: isEdit ? 'Updating patient...' : 'Creating patient...',
      success: isEdit ? 'Patient updated' : 'Patient created',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not save patient',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit patient' : 'Add patient'}</DialogTitle>
          <DialogDescription>
            Simulation only -- use an obviously fictional name. Never enter
            real patient information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
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

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'dateOfBirth'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input {...field} type={'date'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'gender'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={'female'}>Female</SelectItem>
                        <SelectItem value={'male'}>Male</SelectItem>
                        <SelectItem value={'other'}>Other</SelectItem>
                        <SelectItem value={'unknown'}>Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {isEdit ? 'Save changes' : 'Add patient'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
