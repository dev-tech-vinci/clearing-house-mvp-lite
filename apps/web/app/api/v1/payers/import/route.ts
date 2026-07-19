import { NextRequest } from 'next/server';

import { ImportPayersSchema } from '@kit/payers/schema/payer-import.schema';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requirePlatformAdmin,
} from '../../_lib/api-response';

/**
 * POST /api/v1/payers/import -- bulk upsert payers by sim_payer_id.
 * Platform admin only. Body: { rows: [...] } (same shape the CSV importer
 * in the admin UI parses a .csv file into).
 */
export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, user, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const adminError = await requirePlatformAdmin(client, correlationId);

  if (adminError) {
    return adminError;
  }

  const json = await request.json().catch(() => null);
  const parsed = ImportPayersSchema.safeParse(json);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid import payload', correlationId, parsed.error.issues);
  }

  const rows = parsed.data.rows.map((row) => ({
    sim_payer_id: row.sim_payer_id,
    display_name: row.display_name,
    legal_name: row.legal_name || null,
    category: row.category,
    scope: row.scope,
    state: row.state || null,
    network_name: row.network_name || null,
    enrollment_required: row.enrollment_required,
    test_production: row.test_production,
    is_active: row.is_active,
    updated_by: user!.id,
  }));

  const { data, error } = await client
    .from('payers')
    .upsert(rows, { onConflict: 'sim_payer_id' })
    .select('id, sim_payer_id');

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  return apiOk({ imported: data?.length ?? 0, payers: data }, correlationId, 201);
}
