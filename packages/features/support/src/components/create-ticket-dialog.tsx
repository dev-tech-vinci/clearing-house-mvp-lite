'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';

import { CreateTicketSchema } from '../schema/create-ticket.schema';
import { createTicketAction } from '../server/create-ticket.actions';

export function CreateTicketDialog({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(CreateTicketSchema),
    defaultValues: { organizationId, subject: '', description: '', priority: 'normal' as const },
  });

  const createMutation = useMutation({ mutationFn: createTicketAction });

  const onSubmit = (data: z.input<typeof CreateTicketSchema>) => {
    const promise = createMutation.mutateAsync(data).then(() => {
      setOpen(false);
      form.reset({ organizationId, subject: '', description: '', priority: 'normal' });
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: 'Opening ticket...',
      success: 'Support ticket opened',
      error: (error) => (error instanceof Error ? error.message : 'Could not open ticket'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button data-test={'new-ticket-trigger'} onClick={() => setOpen(true)}>
        New ticket
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a support ticket</DialogTitle>
          <DialogDescription>Simulation data only.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className={'flex flex-col space-y-4'} onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              name={'subject'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input {...field} data-test={'ticket-subject-input'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'description'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-test={'ticket-description-input'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'priority'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-test={'ticket-priority-select'}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={'low'}>Low</SelectItem>
                      <SelectItem value={'normal'}>Normal</SelectItem>
                      <SelectItem value={'high'}>High</SelectItem>
                      <SelectItem value={'urgent'}>Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type={'submit'}
                data-test={'create-ticket-submit'}
                disabled={createMutation.isPending}
              >
                Open ticket
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
