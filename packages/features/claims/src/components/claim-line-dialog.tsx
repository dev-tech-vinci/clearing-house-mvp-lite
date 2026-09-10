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

import {
  SYNTHETIC_CPT_HCPCS_CODES,
  SYNTHETIC_PLACE_OF_SERVICE_CODES,
  SYNTHETIC_REVENUE_CODES,
} from '../lib/synthetic-codes';
import { AddClaimLineSchema } from '../schema/claim-line.schema';
import { addClaimLineAction } from '../server/claim-lines.actions';

interface ClaimDiagnosisRow {
  diagnosis_pointer: number;
  diagnosis_code: string;
}

function defaultValuesFor(claimType: 'professional' | 'institutional', nextLine: number) {
  return {
    claimType,
    lineNumber: nextLine,
    serviceDate: '',
    procedureCode: '',
    revenueCode: '',
    placeOfService: '',
    units: 1,
    chargeAmount: 0,
    diagnosisPointers: [] as number[],
  };
}

export function ClaimLineDialog({
  organizationId,
  claimId,
  claimType,
  nextLineNumber,
  diagnoses,
  open,
  onOpenChange,
}: {
  organizationId: string;
  claimId: string;
  claimType: 'professional' | 'institutional';
  nextLineNumber: number;
  diagnoses: ClaimDiagnosisRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm<z.input<typeof AddClaimLineSchema>>({
    resolver: zodResolver(AddClaimLineSchema),
    defaultValues: {
      organizationId,
      claimId,
      ...defaultValuesFor(claimType, nextLineNumber),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        organizationId,
        claimId,
        ...defaultValuesFor(claimType, nextLineNumber),
      });
    }
  }, [open, organizationId, claimId, claimType, nextLineNumber, form]);

  const addMutation = useMutation({ mutationFn: addClaimLineAction });
  const selectedPointers = form.watch('diagnosisPointers') ?? [];

  const onSubmit = (data: z.input<typeof AddClaimLineSchema>) => {
    const promise = addMutation.mutateAsync(data as never).then((result) => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);

      return result;
    });

    toast.promise(() => promise, {
      loading: 'Adding line...',
      success: 'Line added',
      error: (error) => (error instanceof Error ? error.message : 'Could not add line'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add service line</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              name={'serviceDate'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service date</FormLabel>
                  <FormControl>
                    <Input {...field} type={'date'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {claimType === 'professional' ? (
              <FormField
                name={'procedureCode'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPT/HCPCS code</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-test={'claim-line-code-select'}>
                          <SelectValue placeholder={'Select a procedure code'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SYNTHETIC_CPT_HCPCS_CODES.map((code) => (
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
            ) : (
              <FormField
                name={'revenueCode'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenue code</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-test={'claim-line-code-select'}>
                          <SelectValue placeholder={'Select a revenue code'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SYNTHETIC_REVENUE_CODES.map((code) => (
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
            )}

            {claimType === 'professional' && (
              <FormField
                name={'placeOfService'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place of service (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-test={'claim-line-pos-select'}>
                          <SelectValue placeholder={'Select a place of service'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SYNTHETIC_PLACE_OF_SERVICE_CODES.map((code) => (
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
            )}

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'units'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units</FormLabel>
                    <FormControl>
                      <Input {...field} type={'number'} min={1} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'chargeAmount'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charge amount</FormLabel>
                    <FormControl>
                      <Input {...field} type={'number'} min={0} step={'0.01'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {diagnoses.length > 0 && (
              <div>
                <FormLabel>Diagnosis pointers</FormLabel>
                <div className={'mt-2 flex flex-wrap gap-3'}>
                  {diagnoses.map((diagnosis) => (
                    <label
                      key={diagnosis.diagnosis_pointer}
                      className={'flex items-center space-x-1 text-sm'}
                    >
                      <Checkbox
                        checked={selectedPointers.includes(diagnosis.diagnosis_pointer)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...selectedPointers, diagnosis.diagnosis_pointer]
                            : selectedPointers.filter(
                                (p) => p !== diagnosis.diagnosis_pointer,
                              );

                          form.setValue('diagnosisPointers', next, {
                            shouldValidate: true,
                          });
                        }}
                      />
                      <span>
                        #{diagnosis.diagnosis_pointer} ({diagnosis.diagnosis_code})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type={'submit'}
                data-test={'add-claim-line-submit'}
                disabled={addMutation.isPending}
              >
                Add line
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
