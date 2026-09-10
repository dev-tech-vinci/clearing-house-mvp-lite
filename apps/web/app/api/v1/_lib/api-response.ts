import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseApiClient } from '@kit/supabase/api-client';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { Database } from '~/lib/database.types';

/**
 * Structured error envelope for every /api/v1/* response, per the
 * cross-cutting contract in CLAUDE.md: { error: { code, message,
 * correlationId, details? } }. audit_events coverage on this surface is
 * still partial (see docs/progress/DECISIONS.md) -- idempotency
 * (processing_jobs.claim_id, remittances.claim_id, payment_matches.eft_trace_id
 * unique constraints) is real and DB-enforced.
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
 * Auth for /api/v1/* routes. Two paths, both real user auth -- neither
 * ever touches the service-role key:
 *
 * 1. Bearer token (Authorization: Bearer <access_token>) -- for non-browser
 *    clients that can't carry a Next.js SSR cookie session (e.g. the
 *    Phase 9 Python test client). The token is verified against Supabase
 *    Auth itself (auth.getUser(token), a real network round-trip, not a
 *    local decode) and the returned client is bound to that same token
 *    via a per-request header, so every subsequent .from()/.rpc() call is
 *    RLS-scoped to that user exactly as a cookie session would be. An
 *    invalid or expired token is a 401, not a fallback to any other auth.
 * 2. Cookie/SSR session (the pre-existing path) -- for the browser and
 *    Playwright, unchanged. Next.js's CSRF protection (apps/web/middleware.ts)
 *    already covers this path; it does not apply to the stateless Bearer
 *    path, which carries no cookie for CSRF to protect in the first place.
 *
 * Returns the authenticated user's client and identity, or an error
 * Response ready to return directly.
 */
export async function requireApiUser(request: NextRequest, correlationId: string) {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(authHeader.indexOf(' ') + 1).trim();
    const client = getSupabaseApiClient<Database>(token);
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      return {
        client,
        user: null,
        errorResponse: apiError(401, 'unauthorized', 'Invalid or expired bearer token', correlationId),
      } as const;
    }

    return { client, user: { id: data.user.id }, errorResponse: null } as const;
  }

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
