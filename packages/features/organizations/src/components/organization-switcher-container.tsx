import { cookies } from 'next/headers';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CURRENT_ORGANIZATION_COOKIE } from '../constants';
import { createOrganizationsApi } from '../server/organizations.api';
import { OrganizationSwitcher } from './organization-switcher';

/**
 * @name resolveCurrentOrganizationId
 * @description Reads the current-organization cookie and falls back to the
 * caller's first membership if it is missing or no longer valid (e.g. they
 * were removed from that org). Used by both the switcher and by pages that
 * need to know "which org am I looking at right now".
 */
export async function resolveCurrentOrganizationId() {
  const client = getSupabaseServerClient();
  const api = createOrganizationsApi(client);
  const memberships = await api.listMyMemberships();

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(CURRENT_ORGANIZATION_COOKIE)?.value;

  const isValid = memberships.some((m) => m.organization?.id === cookieOrgId);

  return {
    memberships,
    currentOrganizationId: isValid
      ? (cookieOrgId as string)
      : (memberships[0]?.organization?.id ?? null),
  };
}

export async function OrganizationSwitcherContainer() {
  const { memberships, currentOrganizationId } =
    await resolveCurrentOrganizationId();

  const organizations = memberships
    .filter((m) => m.organization)
    .map((m) => ({
      id: m.organization!.id,
      name: m.organization!.name,
      roleName: m.role?.name ?? '',
    }));

  return (
    <OrganizationSwitcher
      organizations={organizations}
      currentOrganizationId={currentOrganizationId}
    />
  );
}
