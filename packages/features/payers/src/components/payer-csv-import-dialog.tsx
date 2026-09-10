'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
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

import { parseCsvToRecords } from '../lib/csv';
import { PAYER_CSV_COLUMNS, PayerImportRowSchema } from '../schema/payer-import.schema';
import { importPayersAction } from '../server/payers.actions';

export function PayerCsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<
    ReturnType<typeof PayerImportRowSchema.parse>[]
  >([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const importMutation = useMutation({ mutationFn: importPayersAction });

  const onFileSelected = async (file: File) => {
    setFileName(file.name);

    const text = await file.text();
    const records = parseCsvToRecords(text);
    const rows: ReturnType<typeof PayerImportRowSchema.parse>[] = [];
    const errors: string[] = [];

    records.forEach((record, index) => {
      const result = PayerImportRowSchema.safeParse(record);

      if (result.success) {
        rows.push(result.data);
      } else {
        errors.push(`Row ${index + 2}: ${result.error.issues.map((i) => i.message).join(', ')}`);
      }
    });

    setParsedRows(rows);
    setParseErrors(errors);
  };

  const onImport = () => {
    const promise = importMutation.mutateAsync({ rows: parsedRows }).then((result) => {
      onOpenChange(false);
      setFileName(null);
      setParsedRows([]);
      setParseErrors([]);
      setTimeout(() => router.refresh(), 0);

      return result;
    });

    toast.promise(() => promise, {
      loading: 'Importing payers...',
      success: (result) => `Imported ${result.count} payer(s)`,
      error: (error) => (error instanceof Error ? error.message : 'Import failed'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import payers from CSV</DialogTitle>
          <DialogDescription>
            Upserts by sim_payer_id (must start with &quot;SIM-&quot;). Expected columns:{' '}
            {PAYER_CSV_COLUMNS.join(', ')}.
          </DialogDescription>
        </DialogHeader>

        <div className={'flex flex-col space-y-3'}>
          <input
            ref={fileInputRef}
            type={'file'}
            accept={'.csv,text/csv'}
            data-test={'payer-csv-file-input'}
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                void onFileSelected(file);
              }
            }}
          />

          {fileName && (
            <p className={'text-muted-foreground text-sm'}>
              {fileName}: {parsedRows.length} valid row(s), {parseErrors.length} error(s)
            </p>
          )}

          {parseErrors.length > 0 && (
            <div
              data-test={'payer-csv-errors'}
              className={'border-destructive/50 text-destructive max-h-32 overflow-y-auto rounded-md border p-2 text-xs'}
            >
              {parseErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            data-test={'payer-csv-import-submit'}
            disabled={parsedRows.length === 0 || importMutation.isPending}
            onClick={onImport}
          >
            Import {parsedRows.length || ''} payer(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
