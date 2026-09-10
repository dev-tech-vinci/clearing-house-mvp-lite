'use client';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import type { PermissionKey } from '../permissions';

/**
 * @name useHasPermission
 * @description Client-side check of the caller's permission in an
 * organization, for conditionally rendering UI. Not a substitute for
 * server-side/RLS enforcement -- it only controls what the UI shows.
 */
export function useHasPermission(
  organizationId: string | undefined,
  permissionKey: PermissionKey,
) {
  const client = useSupabase();

  return useQuery({
    queryKey: ['access-control:has-permission', organizationId, permissionKey],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await client.rpc('has_permission', {
        target_org_id: organizationId as string,
        permission_key: permissionKey,
      });

      if (error) {
        throw error;
      }

      return data;
    },
  });
}
