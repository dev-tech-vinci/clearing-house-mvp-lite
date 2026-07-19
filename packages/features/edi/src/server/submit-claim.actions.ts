'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { DeterministicClaimProcessor } from 'worker/claim-processor';

import { SubmitClaimSchema } from '../schema/submit-claim.schema';

/**
 * Submits an approved claim: re-validates, generates a synthetic 837 +
 * control numbers, and walks it through TA1 -> 999 -> 277CA ->
 * accepted_for_adjudication, all synchronously (the ClaimProcessor
 * interface in apps/worker is what lets this move behind a durable queue
 * later without this action changing). Idempotent -- a second call with
 * the same claimId is a no-op processing-wise (see
 * DeterministicClaimProcessor.process and docs/progress/DECISIONS.md).
 */
export const submitClaimAction = enhanceAction(
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

    if (claim.status !== 'approved') {
      throw new Error(
        'Only an approved claim can be submitted -- validate and approve it first.',
      );
    }

    const processor = new DeterministicClaimProcessor();

    const result = await processor.process(client, {
      claimId: data.claimId,
      organizationId: claim.organization_id,
      userId: user.id,
      idempotencyKey: `submit:${data.claimId}`,
    });

    revalidatePath(`/home/claims/${data.claimId}`);

    return result;
  },
  { schema: SubmitClaimSchema },
);
