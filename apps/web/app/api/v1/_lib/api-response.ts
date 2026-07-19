import 'server-only';

import { NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { Database } from '~/lib/database.types';

/**
 * Structured error envelope for every /api/v1/* response, per the
 * cross-cutting contract in CLAUDE.md: { error: { code, message,
 * correlationId, details? } }. Idempotency keys and an audit_events row
 * are NOT implemented here -- neither exists yet for this surface
 * (idempotency infra is scoped to Phase 6's claim-submission path;
 * audit_events is a Phase 8 table). See docs/progress/DECISIONS.md.
 */
export function newCorrelationId() {
  return crypto.randomUUID();
}

export function apiError(
  status: number,
  code: string,
  message: string,
  correlationId: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, correlationId, ...(details ? { details } : {}) } },
    { status, headers: { 'x-correlation-id': correlationId } },
  );
}

export function apiOk<T>(data: T, correlationId: string, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'x-correlation-id': correlationId },
  });
}

/**
 * JWT auth for /api/v1/* routes. Returns the authenticated user's client
 * and JWT, or an error Response ready to return directly.
 */
export async function requireApiUser(correlationId: string) {
  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  if (auth.error) {
    return {
      client,
      user: null,
      errorResponse: apiError(401, 'unauthorized', 'Authentication required', correlationId),
    } as const;
  }

  return { client, user: auth.data, errorResponse: null } as const;
}

/**
 * Platform-admin check for /api/v1/payers write routes (POST/PATCH),
 * built on the same is_platform_admin() RPC used by RLS.
 */
export async function requirePlatformAdmin(
  client: SupabaseClient<Database>,
  correlationId: string,
) {
  const { data: isAdmin, error } = await client.rpc('is_platform_admin');

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  if (!isAdmin) {
    return apiError(
      403,
      'forbidden',
      'This action requires the platform_super_admin role',
      correlationId,
    );
  }

  return null;
}

/**
 * Org-permission check for /api/v1/claims write routes, mirroring
 * requirePlatformAdmin but for an org-scoped permission (has_permission)
 * instead of the global is_platform_admin() check.
 */
export async function requireOrgPermission(
  client: SupabaseClient<Database>,
  organizationId: string,
  permissionKey: string,
  correlationId: string,
) {
  const { data: allowed, error } = await client.rpc('has_permission', {
    target_org_id: organizationId,
    permission_key: permissionKey,
  });

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  if (!allowed) {
    return apiError(
      403,
      'forbidden',
      `This action requires the ${permissionKey} permission`,
      correlationId,
    );
  }

  return null;
}

/**
 * Platform-wide permission check for /api/v1/support routes (e.g.
 * entering a support-access session), mirroring requirePlatformAdmin but
 * built on has_platform_permission() -- any is_platform_role=true role
 * (support_manager/support_agent, not just platform_super_admin)
 * carrying the given permission key.
 */
export async function requirePlatformPermission(
  client: SupabaseClient<Database>,
  permissionKey: string,
  correlationId: string,
) {
  const { data: allowed, error } = await client.rpc('has_platform_permission', {
    permission_key: permissionKey,
  });

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  if (!allowed) {
    return apiError(
      403,
      'forbidden',
      `This action requires the ${permissionKey} permission`,
      correlationId,
    );
  }

  return null;
}

export function parsePagination(searchParams: URLSearchParams) {
  const limitParam = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
  const cursor = searchParams.get('cursor');
  const offset = cursor ? Number(cursor) || 0 : 0;

  return { limit, offset };
}
