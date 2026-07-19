'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CURRENT_ORGANIZATION_COOKIE } from '../constants';
import { AcceptInvitationSchema } from '../schema/accept-invitation.schema';
import { CreateOrganizationSchema } from '../schema/create-organization.schema';
import { InviteMemberSchema } from '../schema/invite-member.schema';
import { RemoveMemberSchema } from '../schema/remove-member.schema';
import { RevokeInvitationSchema } from '../schema/revoke-invitation.schema';
import { SwitchOrganizationSchema } from '../schema/switch-organization.schema';
import { UpdateMemberRoleSchema } from '../schema/update-member-role.schema';

/**
 * @name createOrganizationAction
 * @description Creates a new organization and atomically makes the caller
 * its org_owner (public.create_organization RPC), then switches the
 * caller's current organization to it.
 */
export const createOrganizationAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { data: organization, error } = await client.rpc(
      'create_organization',
      { org_name: data.name, org_slug: data.slug },
    );

    if (error) {
      throw error;
    }

    (await cookies()).set(CURRENT_ORGANIZATION_COOKIE, organization.id);

    revalidatePath('/home', 'layout');

    return organization;
  },
  { schema: CreateOrganizationSchema },
);

/**
 * @name switchOrganizationAction
 * @description Sets the caller's current-organization cookie. Does not
 * itself check membership -- every subsequent read is still RLS-scoped.
 */
export const switchOrganizationAction = enhanceAction(
  async (data) => {
    (await cookies()).set(CURRENT_ORGANIZATION_COOKIE, data.organizationId);

    revalidatePath('/home', 'layout');

    return { success: true };
  },
  { schema: SwitchOrganizationSchema },
);

/**
 * @name inviteMemberAction
 * @description Invites a member by email into an organization. Runs as the
 * calling user -- the invitations INSERT RLS policy (members.invite
 * permission) is the real enforcement, this action just resolves the role
 * key to a role_id and performs the insert.
 */
export const inviteMemberAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: role, error: roleError } = await client
      .from('roles')
      .select('id')
      .eq('key', data.roleKey)
      .single();

    if (roleError) {
      throw roleError;
    }

    const { error } = await client.from('invitations').insert({
      organization_id: data.organizationId,
      email: data.email,
      role_id: role.id,
      invited_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/users');

    return { success: true };
  },
  { schema: InviteMemberSchema },
);

/**
 * @name revokeInvitationAction
 * @description Revokes a pending invitation. Enforced by the invitations
 * UPDATE RLS policy (members.invite permission).
 */
export const revokeInvitationAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', data.invitationId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/users');

    return { success: true };
  },
  { schema: RevokeInvitationSchema },
);

/**
 * @name updateMemberRoleAction
 * @description Changes a member's role. Enforced by the
 * organization_memberships UPDATE RLS policy (members.assign_role
 * permission).
 */
export const updateMemberRoleAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: role, error: roleError } = await client
      .from('roles')
      .select('id')
      .eq('key', data.roleKey)
      .single();

    if (roleError) {
      throw roleError;
    }

    const { data: previous, error: previousError } = await client
      .from('organization_memberships')
      .select('organization_id, user_id, role:roles(key)')
      .eq('id', data.membershipId)
      .single();

    if (previousError) {
      throw previousError;
    }

    const { error } = await client
      .from('organization_memberships')
      .update({ role_id: role.id, updated_by: user.id })
      .eq('id', data.membershipId);

    if (error) {
      throw error;
    }

    await logAuditEvent(client, {
      organizationId: previous.organization_id,
      actorId: user.id,
      action: 'member.role_changed',
      targetType: 'organization_membership',
      targetId: data.membershipId,
      metadata: {
        memberUserId: previous.user_id,
        fromRole: previous.role?.key ?? null,
        toRole: data.roleKey,
      },
    });

    revalidatePath('/home/users');

    return { success: true };
  },
  { schema: UpdateMemberRoleSchema },
);

/**
 * @name removeMemberAction
 * @description Soft-removes a member from an organization. Enforced by the
 * organization_memberships UPDATE RLS policy (members.assign_role
 * permission).
 */
export const removeMemberAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('organization_memberships')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', data.membershipId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/users');

    return { success: true };
  },
  { schema: RemoveMemberSchema },
);

/**
 * @name acceptInvitationAction
 * @description Accepts an invitation via the public.accept_invitation RPC,
 * which validates the token/email/expiry binding server-side.
 */
export const acceptInvitationAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { data: membership, error } = await client.rpc(
      'accept_invitation',
      { invitation_token: data.token },
    );

    if (error) {
      throw error;
    }

    (await cookies()).set(
      CURRENT_ORGANIZATION_COOKIE,
      membership.organization_id,
    );

    revalidatePath('/home', 'layout');

    return membership;
  },
  { schema: AcceptInvitationSchema },
);
