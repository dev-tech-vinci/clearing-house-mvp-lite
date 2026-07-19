'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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

import { createOrganizationAction } from '../server/server-actions';
import { CreateOrganizationSchema } from '../schema/create-organization.schema';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [slugTouched, setSlugTouched] = useState(false);
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: { name: '', slug: '' },
  });

  const mutation = useMutation({
    mutationFn: createOrganizationAction,
  });

  const onSubmit = (data: { name: string; slug: string }) => {
    const promise = mutation.mutateAsync(data).then(() => {
      onOpenChange(false);
      form.reset();
      setSlugTouched(false);

      // Deferred to the next tick so the dialog's close animation isn't
      // interrupted by the RSC tree refresh landing in the same commit.
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: 'Creating organization...',
      success: 'Organization created',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not create organization',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            Simulation data only -- use a synthetic (SIM-) organization name.
          </DialogDescription>
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
                  <FormLabel>Organization name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={'SIM Behavioral Health Group'}
                      onChange={(e) => {
                        field.onChange(e);

                        if (!slugTouched) {
                          form.setValue('slug', slugify(e.target.value), {
                            shouldValidate: true,
                          });
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'slug'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={'sim-behavioral-health-group'}
                      onChange={(e) => {
                        setSlugTouched(true);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type={'submit'} disabled={mutation.isPending}>
                Create organization
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
