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
import { Form } from '@kit/ui/form';

import { RuleVersionFormSchema } from '../schema/payer-rule.schema';
import { addRuleVersionAction } from '../server/payer-rules.actions';
import { RuleVersionFields } from './rule-dialog';

type RuleVersionRow = Database['public']['Tables']['payer_rule_versions']['Row'];

/**
 * Adds a new version to an existing rule. Rule identity (code, category,
 * payer, claim type) is fixed and shown as read-only context -- only the
 * versioned content fields are editable. Never mutates an existing
 * version row.
 */
export function AddRuleVersionDialog({
  ruleCode,
  payerRuleId,
  latestVersion,
  open,
  onOpenChange,
}: {
  ruleCode: string;
  payerRuleId: string;
  latestVersion?: RuleVersionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(RuleVersionFormSchema),
    defaultValues: {
      payerRuleId,
      fieldPath: '',
      condition: '',
      outcome: 'reject' as const,
      severity: 'error' as const,
      rejectionOrDenial: 'rejection' as const,
      explanation: '',
      suggestedCorrection: '',
      effectiveDate: '',
      expirationDate: '',
      source: '',
    },
  });

  useEffect(() => {
    if (open && latestVersion) {
      form.reset({
        payerRuleId,
        fieldPath: latestVersion.field_path ?? '',
        condition: latestVersion.condition,
        outcome: latestVersion.outcome as 'reject' | 'deny' | 'warn' | 'info',
        severity: latestVersion.severity as 'error' | 'warning' | 'info',
        rejectionOrDenial: latestVersion.rejection_or_denial as
          | 'rejection'
          | 'denial'
          | 'not_applicable',
        explanation: latestVersion.explanation,
        suggestedCorrection: latestVersion.suggested_correction ?? '',
        effectiveDate: latestVersion.effective_date ?? '',
        expirationDate: latestVersion.expiration_date ?? '',
        source: latestVersion.source ?? '',
      });
    }
  }, [open, latestVersion, payerRuleId, form]);

  const mutation = useMutation({ mutationFn: addRuleVersionAction });

  const onSubmit = (data: z.input<typeof RuleVersionFormSchema>) => {
    const promise = mutation
      .mutateAsync({ ...data, payerRuleId } as never)
      .then(() => {
        onOpenChange(false);
        setTimeout(() => router.refresh(), 0);
      });

    toast.promise(() => promise, {
      loading: 'Adding new version...',
      success: (result) =>
        typeof result === 'object' && result && 'versionNumber' in result
          ? `Version ${(result as { versionNumber: number }).versionNumber} added`
          : 'New version added',
      error: (error) => (error instanceof Error ? error.message : 'Could not add version'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={'max-h-[90vh] overflow-y-auto sm:max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>Edit rule: new version</DialogTitle>
          <DialogDescription>
            {ruleCode} -- this creates a new version; the current version stays
            in the history and is never modified.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <RuleVersionFields />

            <DialogFooter>
              <Button type={'submit'} disabled={mutation.isPending}>
                Save as new version
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
