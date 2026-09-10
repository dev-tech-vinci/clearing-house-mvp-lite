import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

import type { PermissionKey } from '../permissions';
import type { RoleKey } from '../roles';

/**
 * @name hasOrgAccess
 * @description Checks whether the caller (as identified by the client's own
 * session) has an active membership in the given organization. Runs as the
 * calling user -- RLS on the underlying tables still applies to everything
 * else in the request, this is just a read of the has_org_access() RPC.
 */
export async function hasOrgAccess(
  client: SupabaseClient<Database>,
  organizationId: string,
) {
  const { data, error } = await client.rpc('has_org_access', {
    target_org_id: organizationId,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * @name hasPermission
 * @description Checks whether the caller's role in the given organization
 * grants the named permission.
 */
export async function hasPermission(
  client: SupabaseClient<Database>,
  organizationId: string,
  permissionKey: PermissionKey,
) {
  const { data, error } = await client.rpc('has_permission', {
    target_org_id: organizationId,
    permission_key: permissionKey,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * @name hasRole
 * @description Checks whether the caller holds the given role key in any
 * organization membership (not scoped to a specific target organization).
 * Used for platform-wide roles like support_manager/support_agent.
 */
export async function hasRole(client: SupabaseClient<Database>, roleKey: RoleKey) {
  const { data, error } = await client.rpc('has_role', { role_key: roleKey });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * @name hasPlatformPermission
 * @description Checks whether the caller holds a platform-wide role
 * (is_platform_role=true) carrying the given permission key -- not scoped
 * to a specific target organization, unlike hasPermission().
 */
export async function hasPlatformPermission(
  client: SupabaseClient<Database>,
  permissionKey: PermissionKey,
) {
  const { data, error } = await client.rpc('has_platform_permission', {
    permission_key: permissionKey,
  });

  if (error) {
    throw error;
  }

  return data;
}
