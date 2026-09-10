'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DeterministicClaimProcessor } from 'worker/claim-processor';

import { MatchEftSchema } from '../schema/match-eft.schema';

/**
 * The explicit Payment Reconciliation action: matches a paid remittance's
 * simulated EFT deposit and posts it. Never runs automatically during
 * adjudication.
 */
export const matchEftAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: remittance, error } = await client
      .from('remittances')
      .select('organization_id, claim_id')
      .eq('id', data.remittanceId)
      .single();

    if (error) {
      throw error;
    }

    const processor = new DeterministicClaimProcessor();

    const result = await processor.matchEft(client, {
      remittanceId: data.remittanceId,
      organizationId: remittance.organization_id,
      userId: user.id,
    });

    revalidatePath('/home/remittances');
    revalidatePath(`/home/claims/${remittance.claim_id}`);

    return result;
  },
  { schema: MatchEftSchema },
);
