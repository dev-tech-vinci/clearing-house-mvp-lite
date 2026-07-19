import { NextRequest } from 'next/server';

import { CreatePayerSchema } from '@kit/payers/schema/payer.schema';

import {
  apiError,
  apiOk,
  newCorrelationId,
  parsePagination,
  requireApiUser,
  requirePlatformAdmin,
} from '../_lib/api-response';

/**
 * GET /api/v1/payers -- list the global payer directory. Any authenticated
 * user may read (RLS enforces the same). Supports ?category=, ?search=,
 * ?limit=, ?cursor= (offset-based, echoed back as nextCursor).
 */
export async function GET(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const { limit, offset } = parsePagination(searchParams);
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let query = client
    .from('payers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(`display_name.ilike.%${search}%,sim_payer_id.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  const nextCursor = offset + limit < (count ?? 0) ? String(offset + limit) : null;

  return apiOk({ data, pagination: { limit, count, nextCursor } }, correlationId);
}

/**
 * POST /api/v1/payers -- create a payer. Platform admin only (checked
 * explicitly here for a clean 403 JSON envelope; RLS enforces the same
 * regardless).
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
  const parsed = CreatePayerSchema.safeParse(json);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid payer payload', correlationId, parsed.error.issues);
  }

  const data = parsed.data;

  const { data: payer, error } = await client
    .from('payers')
    .insert({
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
      created_by: user!.id,
      updated_by: user!.id,
    })
    .select('*')
    .single();

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  return apiOk(payer, correlationId, 201);
}
