import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading organizations, memberships and
 * invitations. All methods run as the calling user -- every result is
 * already scoped by RLS (has_org_access / has_permission), not filtered
 * client-side.
 */
class OrganizationsApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * @name listMyMemberships
   * @description List every organization the calling user belongs to,
   * along with their role in each. RLS on organization_memberships already
   * scopes this to "my" rows.
   */
  async listMyMemberships() {
    const { data, error } = await this.client
      .from('organization_memberships')
      .select(
        'id, created_at, organization:organizations(id, name, slug), role:roles(key, name)',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @name getOrganization
   * @description Get a single organization by ID. Returns null if the
   * caller has no access (RLS) or the org doesn't exist.
   */
  async getOrganization(organizationId: string) {
    const { data, error } = await this.client
      .from('organizations')
      .select('id, name, slug, created_at')
      .eq('id', organizationId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @name listMembers
   * @description List every member of an organization with their role,
   * via the tenant-scoped get_organization_members() RPC.
   */
  async listMembers(organizationId: string) {
    const { data, error } = await this.client.rpc('get_organization_members', {
      target_org_id: organizationId,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @name listInvitations
   * @description List invitations for an organization (any status), most
   * recent first. RLS scopes this to organizations the caller belongs to.
   */
  async listInvitations(organizationId: string) {
    const { data, error } = await this.client
      .from('invitations')
      .select('id, email, status, expires_at, created_at, role:roles(key, name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createOrganizationsApi(client: SupabaseClient<Database>) {
  return new OrganizationsApi(client);
}
