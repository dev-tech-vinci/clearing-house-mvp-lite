'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
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

import { SYNTHETIC_ICD10_CODES } from '../lib/synthetic-codes';
import { AddClaimDiagnosisSchema } from '../schema/claim-diagnosis.schema';
import { addClaimDiagnosisAction } from '../server/claim-diagnoses.actions';

const defaultValues = {
  diagnosisCode: '',
  diagnosisPointer: 1,
  isPrimary: false,
};

export function ClaimDiagnosisDialog({
  organizationId,
  claimId,
  nextPointer,
  open,
  onOpenChange,
}: {
  organizationId: string;
  claimId: string;
  nextPointer: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm<z.input<typeof AddClaimDiagnosisSchema>>({
    resolver: zodResolver(AddClaimDiagnosisSchema),
    defaultValues: { organizationId, claimId, ...defaultValues },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        organizationId,
        claimId,
        ...defaultValues,
        diagnosisPointer: nextPointer,
      });
    }
  }, [open, organizationId, claimId, nextPointer, form]);

  const addMutation = useMutation({ mutationFn: addClaimDiagnosisAction });

  const onSubmit = (data: z.input<typeof AddClaimDiagnosisSchema>) => {
    const promise = addMutation.mutateAsync(data as never).then((result) => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);

      return result;
    });

    toast.promise(() => promise, {
      loading: 'Adding diagnosis...',
      success: 'Diagnosis added',
      error: (error) => (error instanceof Error ? error.message : 'Could not add diagnosis'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add diagnosis</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              name={'diagnosisCode'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ICD-10-CM code</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-test={'claim-diagnosis-code-select'}>
                        <SelectValue placeholder={'Select a diagnosis code'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SYNTHETIC_ICD10_CODES.map((code) => (
                        <SelectItem key={code.code} value={code.code}>
                          {code.code} -- {code.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'diagnosisPointer'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pointer</FormLabel>
                  <FormControl>
                    <Input {...field} type={'number'} min={1} max={12} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'isPrimary'}
              render={({ field }) => (
                <FormItem className={'flex flex-row items-center space-x-2'}>
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className={'!mt-0'}>Primary diagnosis</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type={'submit'}
                data-test={'add-claim-diagnosis-submit'}
                disabled={addMutation.isPending}
              >
                Add diagnosis
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
