import { NextRequest } from 'next/server';

import { z } from 'zod';

import {
  CreateInstitutionalClaimSchema,
  CreateProfessionalClaimSchema,
} from '@kit/claims/schema/claim.schema';
import { findUnsupportedLoop } from '@kit/claims/lib/unsupported-loops';

import {
  apiError,
  apiOk,
  newCorrelationId,
  parsePagination,
  requireApiUser,
  requireOrgPermission,
} from '../_lib/api-response';

/**
 * GET /api/v1/claims?organizationId= -- list claims for an organization.
 * Requires org membership (RLS enforces the same). ?limit=/?cursor= is
 * offset-based, echoed back as nextCursor.
 */
export async function GET(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const organizationId = searchParams.get('organizationId');

  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    return apiError(400, 'validation_error', 'organizationId query parameter is required', correlationId);
  }

  const { limit, offset } = parsePagination(searchParams);

  const { data, error, count } = await client
    .from('claims')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  const nextCursor = offset + limit < (count ?? 0) ? String(offset + limit) : null;

  return apiOk({ data, pagination: { limit, count, nextCursor } }, correlationId);
}

/**
 * POST /api/v1/claims -- create a professional or institutional claim
 * (discriminated by `claimType` in the body). Requires claims.create_edit
 * in the target organization. Rejects the deliberate 837P/837I
 * out-of-scope loops (COB, ambulance cert, drug detail, 2300 attachments,
 * 2420 loops beyond rendering provider, NCPDP, occurrence/value/condition
 * codes) with an explicit 422 rather than silently ignoring them -- see
 * docs/05-claim-lifecycle.md.
 */
export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const json = await request.json().catch(() => null);

  if (!json || typeof json !== 'object') {
    return apiError(400, 'validation_error', 'Invalid claim payload', correlationId);
  }

  const body = json as Record<string, unknown>;
  const unsupported = findUnsupportedLoop(body);

  if (unsupported) {
    return apiError(422, 'unsupported_loop', unsupported.message, correlationId, {
      loop: unsupported.loop,
    });
  }

  if (body.claimType !== 'professional' && body.claimType !== 'institutional') {
    return apiError(
      400,
      'validation_error',
      'claimType must be "professional" or "institutional"',
      correlationId,
    );
  }

  const isProfessional = body.claimType === 'professional';
  const schema = isProfessional
    ? CreateProfessionalClaimSchema
    : CreateInstitutionalClaimSchema;
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid claim payload', correlationId, parsed.error.issues);
  }

  const data = parsed.data;

  const permissionError = await requireOrgPermission(
    client,
    data.organizationId,
    'claims.create_edit',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  const { data: claim, error } = isProfessional
    ? await client.rpc('create_professional_claim', {
        p_organization_id: data.organizationId,
        p_patient_id: data.patientId,
        p_subscriber_id: data.subscriberId,
        p_coverage_id: data.coverageId,
        p_billing_provider_id: data.billingProviderId,
        p_rendering_provider_id: (data as CreateProfessionalClaimSchema)
          .renderingProviderId,
        p_notes: data.notes || undefined,
      })
    : await client.rpc('create_institutional_claim', {
        p_organization_id: data.organizationId,
        p_patient_id: data.patientId,
        p_subscriber_id: data.subscriberId,
        p_coverage_id: data.coverageId,
        p_billing_provider_id: data.billingProviderId,
        p_facility_id: (data as CreateInstitutionalClaimSchema).facilityId,
        p_type_of_bill: (data as CreateInstitutionalClaimSchema).typeOfBill,
        p_admission_date:
          (data as CreateInstitutionalClaimSchema).admissionDate || undefined,
        p_discharge_date:
          (data as CreateInstitutionalClaimSchema).dischargeDate || undefined,
        p_notes: data.notes || undefined,
      });

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  return apiOk(claim, correlationId, 201);
}
