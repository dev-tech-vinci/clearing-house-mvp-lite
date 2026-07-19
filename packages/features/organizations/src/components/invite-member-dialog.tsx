'use client';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ROLES } from '@kit/access-control/roles';
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

import { InviteMemberSchema } from '../schema/invite-member.schema';
import { inviteMemberAction } from '../server/server-actions';

const INVITABLE_ROLE_OPTIONS = [
  { key: ROLES.ORG_ADMIN, label: 'Org Admin' },
  { key: ROLES.CLAIMS_MANAGER, label: 'Claims Manager' },
  { key: ROLES.CLAIMS_SPECIALIST, label: 'Claims Specialist' },
  { key: ROLES.REMITTANCE_SPECIALIST, label: 'Remittance Specialist' },
  { key: ROLES.READ_ONLY_AUDITOR, label: 'Read-Only Auditor' },
];

export function InviteMemberDialog({
  organizationId,
  open,
  onOpenChange,
  onInvited,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: () => void;
}) {
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(InviteMemberSchema),
    defaultValues: {
      organizationId,
      email: '',
      roleKey: ROLES.CLAIMS_SPECIALIST,
    },
  });

  const mutation = useMutation({
    mutationFn: inviteMemberAction,
  });

  const onSubmit = (data: {
    organizationId: string;
    email: string;
    roleKey: string;
  }) => {
    const promise = mutation.mutateAsync(data).then(() => {
      onOpenChange(false);
      form.reset({ organizationId, email: '', roleKey: ROLES.CLAIMS_SPECIALIST });

      // Deferred to the next tick so the dialog's close animation isn't
      // interrupted by the RSC tree refresh landing in the same commit.
      setTimeout(() => router.refresh(), 0);

      onInvited?.();
    });

    toast.promise(() => promise, {
      loading: 'Sending invitation...',
      success: 'Invitation sent',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not send invitation',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            Simulation data only -- use a synthetic (SIM-) or test email
            address.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              name={'email'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type={'email'}
                      placeholder={'sim-user@example.test'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'roleKey'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INVITABLE_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type={'submit'} disabled={mutation.isPending}>
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
