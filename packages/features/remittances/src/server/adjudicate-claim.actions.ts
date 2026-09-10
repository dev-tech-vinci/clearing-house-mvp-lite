'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DeterministicClaimProcessor } from 'worker/claim-processor';

import { AdjudicateClaimSchema } from '../schema/adjudicate-claim.schema';

/**
 * Adjudicates a claim that's accepted_for_adjudication: deterministic,
 * rule-driven paid/denied outcome (see apps/worker's
 * DeterministicClaimProcessor.adjudicate for the actual logic -- this
 * action is just the auth/validation wrapper). Idempotent -- a second
 * call is a no-op processing-wise.
 */
export const adjudicateClaimAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: claim, error } = await client
      .from('claims')
      .select('organization_id, status')
      .eq('id', data.claimId)
      .single();

    if (error) {
      throw error;
    }

    if (claim.status !== 'accepted_for_adjudication') {
      throw new Error(
        'Only a claim accepted for adjudication can be adjudicated -- submit it first.',
      );
    }

    const processor = new DeterministicClaimProcessor();

    const result = await processor.adjudicate(client, {
      claimId: data.claimId,
      organizationId: claim.organization_id,
      userId: user.id,
    });

    revalidatePath(`/home/claims/${data.claimId}`);
    revalidatePath('/home/remittances');

    return result;
  },
  { schema: AdjudicateClaimSchema },
);
