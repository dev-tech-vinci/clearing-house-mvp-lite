'use client';

import type { Database } from '@kit/supabase/database';
import { Badge } from '@kit/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

type RuleVersionRow = Database['public']['Tables']['payer_rule_versions']['Row'];

export function RuleVersionHistoryDialog({
  ruleCode,
  versions,
  open,
  onOpenChange,
}: {
  ruleCode: string;
  versions: RuleVersionRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={'max-h-[80vh] overflow-y-auto sm:max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>Version history: {ruleCode}</DialogTitle>
          <DialogDescription>
            Versions are never mutated after creation -- each edit adds a new
            row.
          </DialogDescription>
        </DialogHeader>

        <div className={'flex flex-col space-y-4'}>
          {sorted.map((version) => (
            <div key={version.id} className={'rounded-md border p-3'}>
              <div className={'flex items-center justify-between'}>
                <span className={'font-medium'}>Version {version.version_number}</span>
                <div className={'flex gap-x-2'}>
                  <Badge variant={version.rejection_or_denial === 'denial' ? 'destructive' : 'outline'}>
                    {version.rejection_or_denial}
                  </Badge>
                  <Badge variant={'outline'}>{version.severity}</Badge>
                </div>
              </div>

              {version.field_path && (
                <p className={'text-muted-foreground mt-1 text-xs'}>Field: {version.field_path}</p>
              )}

              <p className={'mt-2 text-sm'}>{version.explanation}</p>

              {version.suggested_correction && (
                <p className={'text-muted-foreground mt-1 text-xs'}>
                  Suggested correction: {version.suggested_correction}
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
