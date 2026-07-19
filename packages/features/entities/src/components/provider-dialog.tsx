'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
  ProviderFormSchema,
} from '../schema/provider.schema';
import {
  createProviderAction,
  updateProviderAction,
} from '../server/providers.actions';

type ProviderRow = Database['public']['Tables']['providers']['Row'];

const defaultValues = {
  providerType: 'individual' as const,
  npi: '',
  firstName: '',
  lastName: '',
  organizationName: '',
  taxonomyCode: '',
};

export function ProviderDialog({
  organizationId,
  provider,
  open,
  onOpenChange,
}: {
  organizationId: string;
  provider?: ProviderRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(provider);

  const form = useForm<ProviderFormSchema>({
    resolver: zodResolver(ProviderFormSchema),
    defaultValues: { organizationId, ...defaultValues },
  });

  useEffect(() => {
    if (provider) {
      form.reset({
        organizationId,
        providerId: provider.id,
        providerType: provider.provider_type as 'individual' | 'organization',
        npi: provider.npi,
        firstName: provider.first_name ?? '',
        lastName: provider.last_name ?? '',
        organizationName: provider.organization_name ?? '',
        taxonomyCode: provider.taxonomy_code ?? '',
      });
    } else {
      form.reset({ organizationId, ...defaultValues });
    }
  }, [provider, organizationId, form]);

  const providerType = form.watch('providerType');

  const createMutation = useMutation({ mutationFn: createProviderAction });
  const updateMutation = useMutation({ mutationFn: updateProviderAction });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: ProviderFormSchema) => {
    const promise = (
      isEdit
        ? updateMutation.mutateAsync({ ...data, providerId: data.providerId as string })
        : createMutation.mutateAsync(data)
    ).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: isEdit ? 'Updating provider...' : 'Creating provider...',
      success: isEdit ? 'Provider updated' : 'Provider created',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not save provider',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit provider' : 'Add provider'}</DialogTitle>
          <DialogDescription>
            Simulation data only -- NPI must pass the standard check-digit
            format, but is never a real provider identity.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              name={'providerType'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={'individual'}>
                        Individual (NPI-1)
                      </SelectItem>
                      <SelectItem value={'organization'}>
                        Organization (NPI-2)
                      </SelectItem>
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
                  <FormLabel>NPI</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'e.g. 1234567893'} maxLength={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {providerType === 'individual' ? (
              <div className={'grid grid-cols-2 gap-4'}>
                <FormField
                  name={'firstName'}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={'Simone'} />
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
                        <Input {...field} placeholder={'Fictional'} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <FormField
                name={'organizationName'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'SIM Behavioral Health Group'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              name={'taxonomyCode'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxonomy code (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={'101YM0800X'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type={'submit'} disabled={isPending}>
                {isEdit ? 'Save changes' : 'Add provider'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
