'use client';

import { Badge } from '@kit/ui/badge';

import type { ValidationError } from '../lib/validate-claim';

const SEVERITY_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  error: 'destructive',
  warning: 'secondary',
  info: 'outline',
};

/**
 * Every field here (explanation, suggestedCorrection, severity,
 * rejectionOrDenial) is sourced from the live payer_rule_versions row for
 * the failing rule_code -- nothing here is a hardcoded UI string.
 */
export function ValidationResultsPanel({ errors }: { errors: ValidationError[] }) {
  if (errors.length === 0) {
    return (
      <div
        data-test={'validation-results-panel'}
        className={'rounded-md border border-green-600/30 bg-green-600/5 p-3 text-sm'}
      >
        No validation errors.
      </div>
    );
  }

  return (
    <div data-test={'validation-results-panel'} className={'flex flex-col space-y-2'}>
      {errors.map((error) => (
        <div key={error.ruleCode} className={'rounded-md border p-3 text-sm'}>
          <div className={'flex items-center gap-x-2'}>
            <Badge variant={SEVERITY_VARIANT[error.severity] ?? 'outline'}>
              {error.severity}
            </Badge>
            <Badge variant={'outline'}>
              {error.rejectionOrDenial === 'not_applicable'
                ? 'informational'
                : error.rejectionOrDenial}
            </Badge>
            <span className={'text-muted-foreground font-mono text-xs'}>
              {error.ruleCode}
            </span>
          </div>
          <p className={'mt-1'}>{error.explanation}</p>
          {error.suggestedCorrection && (
            <p className={'text-muted-foreground mt-1 text-xs'}>
              Suggested correction: {error.suggestedCorrection}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
