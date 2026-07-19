import { NextRequest } from 'next/server';

import { z } from 'zod';

import { UpdatePayerSchema } from '@kit/payers/schema/payer.schema';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requirePlatformAdmin,
} from '../../_lib/api-response';

/**
 * PATCH /api/v1/payers/{id} -- update a payer. Platform admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = newCorrelationId();
  const { client, user, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const adminError = await requirePlatformAdmin(client, correlationId);

  if (adminError) {
    return adminError;
  }

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return apiError(400, 'validation_error', 'Invalid payer id', correlationId);
  }

  const json = await request.json().catch(() => null);
  const parsed = UpdatePayerSchema.omit({ payerId: true }).safeParse(json);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid payer payload', correlationId, parsed.error.issues);
  }

  const data = parsed.data;

  const { data: payer, error } = await client
    .from('payers')
    .update({
      sim_payer_id: data.simPayerId,
      display_name: data.displayName,
      legal_name: data.legalName || null,
      category: data.category,
      line_of_business: data.lineOfBusiness || null,
      scope: data.scope,
      state: data.state || null,
      public_program_id: data.publicProgramId || null,
      clearinghouse_payer_id: data.clearinghousePayerId || null,
      network_name: data.networkName || null,
      enrollment_required: data.enrollmentRequired,
      test_production: data.testProduction,
      effective_date: data.effectiveDate || null,
      termination_date: data.terminationDate || null,
      notes: data.notes || null,
      source: data.source || null,
      updated_by: user!.id,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  if (!payer) {
    return apiError(404, 'not_found', 'Payer not found', correlationId);
  }

  return apiOk(payer, correlationId);
}
