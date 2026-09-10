'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { PayerSelect, type PayerSelectOption } from '@kit/payers/components';
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

import {
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  RuleFormSchema,
} from '../schema/payer-rule.schema';
import { createRuleAction } from '../server/payer-rules.actions';

const defaultValues = {
  ruleCode: '',
  category: 'universal' as const,
  payerId: '',
  claimType: undefined,
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
};

export function CreateRuleDialog({
  payers,
  open,
  onOpenChange,
}: {
  payers: PayerSelectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(RuleFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, form]);

  const category = form.watch('category');
  const needsPayer = category === 'payer_edit' || category === 'adjudication';

  const mutation = useMutation({ mutationFn: createRuleAction });

  const onSubmit = (data: z.input<typeof RuleFormSchema>) => {
    const promise = mutation.mutateAsync(data as never).then(() => {
      onOpenChange(false);
      setTimeout(() => router.refresh(), 0);
    });

    toast.promise(() => promise, {
      loading: 'Creating rule...',
      success: 'Rule created (version 1)',
      error: (error) => (error instanceof Error ? error.message : 'Could not create rule'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={'max-h-[90vh] overflow-y-auto sm:max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>Add payer rule</DialogTitle>
          <DialogDescription>
            Rule codes must start with &quot;SIM-&quot;. Universal/claim-type
            rules apply across all payers; payer-edit/adjudication rules
            require a specific payer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className={'flex flex-col space-y-4'}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className={'grid grid-cols-2 gap-4'}>
              <FormField
                name={'ruleCode'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={'SIM-RULE-EXAMPLE-001'} />
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
                        {RULE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {RULE_CATEGORY_LABELS[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {needsPayer && (
              <FormField
                name={'payerId'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payer</FormLabel>
                    <PayerSelect payers={payers} value={field.value} onValueChange={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              name={'claimType'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Claim type (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={'Any claim type'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={'professional'}>Professional (837P)</SelectItem>
                      <SelectItem value={'institutional'}>Institutional (837I)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <RuleVersionFields />

            <DialogFooter>
              <Button type={'submit'} disabled={mutation.isPending}>
                Add rule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shared version-content fields, used by both CreateRuleDialog and
 * AddRuleVersionDialog -- relies on the surrounding <Form> context, so it
 * must be rendered inside a react-hook-form <Form> whose fields include
 * these names.
 */
export function RuleVersionFields() {
  return (
    <>
      <FormField
        name={'fieldPath'}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Field path (optional)</FormLabel>
            <FormControl>
              <Input {...field} placeholder={'claim.diagnoses[0]'} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name={'condition'}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Condition</FormLabel>
            <FormControl>
              <Input {...field} placeholder={'at least one diagnosis code is present'} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className={'grid grid-cols-3 gap-4'}>
        <FormField
          name={'outcome'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Outcome</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={'reject'}>Reject</SelectItem>
                  <SelectItem value={'deny'}>Deny</SelectItem>
                  <SelectItem value={'warn'}>Warn</SelectItem>
                  <SelectItem value={'info'}>Info</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name={'severity'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Severity</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={'error'}>Error</SelectItem>
                  <SelectItem value={'warning'}>Warning</SelectItem>
                  <SelectItem value={'info'}>Info</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name={'rejectionOrDenial'}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rejection or denial</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={'rejection'}>Rejection (pre-adjudication)</SelectItem>
                  <SelectItem value={'denial'}>Denial (post-adjudication)</SelectItem>
                  <SelectItem value={'not_applicable'}>Not applicable</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        name={'explanation'}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Explanation</FormLabel>
            <FormControl>
              <Textarea {...field} placeholder={'Human-readable explanation shown in the trace UI.'} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name={'suggestedCorrection'}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Suggested correction (optional)</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
