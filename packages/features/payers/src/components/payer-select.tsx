'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

export interface PayerSelectOption {
  id: string;
  sim_payer_id: string;
  display_name: string;
}

/**
 * Reusable payer picker, used by packages/features/entities' coverage and
 * enrollment dialogs now that the real payer directory exists (Phase 3
 * left those as free-text payer_label inputs).
 */
export function PayerSelect({
  payers,
  value,
  onValueChange,
  placeholder = 'Select a payer',
}: {
  payers: PayerSelectOption[];
  value: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {payers.map((payer) => (
          <SelectItem key={payer.id} value={payer.id}>
            {payer.display_name} ({payer.sim_payer_id})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
