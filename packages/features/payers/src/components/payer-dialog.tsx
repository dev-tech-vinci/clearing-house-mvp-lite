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
import { Checkbox } from '@kit/ui/checkbox';
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

import { PAYER_CATEGORIES, PAYER_CATEGORY_LABELS, PayerFormSchema } from '../schema/payer.schema';
import { createPayerAction, updatePayerAction } from '../server/payers.actions';

type PayerRow = Database['public']['Tables']['payers']['Row'];

const defaultValues = {
  simPayerId: '',
  displayName: '',
  legalName: '',
  category: 'commercial_ppo' as const,
  lineOfBusiness: '',
  scope: 'national' as const,
  state: '',
  publicProgramId: '',
  clearinghousePayerId: '',
  networkName: '',
  enrollmentRequired: false,
  testProduction: 'test' as const,
  effectiveDate: '',
  terminationDate: '',
  notes: '',
  source: '',
};

export function PayerDialog({
  payer,
  open,
  onOpenChange,
}: {
  payer?: PayerRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(payer);

  const form = useForm<z.input<typeof PayerFormSchema>>({
    resolver: zodResolver(PayerFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (payer) {
      form.reset({
        payerId: payer.id,
        simPayerId: payer.sim_payer_id,
        displayName: payer.display_name,
        legalName: payer.legal_name ?? '',
        category: payer.category as (typeof PAYER_CATEGORIES)[number],
        lineOfBusiness: payer.line_of_business ?? '',
        scope: payer.scope as 'national' | 'state' | 'regional',
        state: payer.state ?? '',
        publicProgramId: payer.public_program_id ?? '',
        clearinghousePayerId: payer.clearinghouse_payer_id ?? '',
        networkName: payer.network_name ?? '',
        enrollmentRequired: payer.enrollment_required,
        testProduction: payer.test_production as 'test' | 'production',
        effectiveDate: payer.effective_date ?? '',
        terminationDate: payer.termination_date ?? '',
        notes: payer.notes ?? '',
        source: payer.source ?? '',
      });
    } else {
      form.reset(defaultValues);
    }
  }, [payer, form]);

  const createMutation = useMutation({ mutationFn: createPayerAction });
  const updateMutation = useMutation({ mutationFn: updatePayerAction });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: z.input<typeof PayerFormSchema>) => {
    const promise = (
      isEdit
        ? updateMutation.mutateAsync({ ...data, payerId: data.payerId as string } as never)
        : createMutation.mutateAsync(data as never)
    ).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: isEdit ? 'Updating payer...' : 'Creating payer...',
      success: isEdit ? 'Payer updated' : 'Payer created',
      error: (error) => (error instanceof Error ? error.message : 'Could not save payer'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={'max-h-[90vh] overflow-y-auto sm:max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit payer' : 'Add payer'}</DialogTitle>
          <DialogDescription>
            Simulation only -- ten clearly-simulated payer profiles, never real
            payer connectivity. IDs must start with &quot;SIM-&quot;.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'simPayerId'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SIM payer ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'SIM-EXAMPLE-001'} disabled={isEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'category'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYER_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {PAYER_CATEGORY_LABELS[category]}
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
              name={'displayName'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'SIM Example Payer'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'legalName'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'SIM Example Payer (Simulated)'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={'grid grid-cols-3 gap-4'}>
              <FormField
                name={'scope'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scope</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={'national'}>National</SelectItem>
                        <SelectItem value={'state'}>State</SelectItem>
                        <SelectItem value={'regional'}>Regional</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'state'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'CA'} maxLength={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'testProduction'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={'test'}>Test</SelectItem>
                        <SelectItem value={'production'}>Production</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name={'networkName'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Network name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'SIM Example Network'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'publicProgramId'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public program ID (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name={'clearinghousePayerId'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clearinghouse payer ID (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name={'enrollmentRequired'}
              render={({ field }) => (
                <FormItem className={'flex flex-row items-center space-y-0 space-x-2'}>
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className={'!mt-0'}>Enrollment required</FormLabel>
                </FormItem>
              )}
            />

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
                {isEdit ? 'Save changes' : 'Add payer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
