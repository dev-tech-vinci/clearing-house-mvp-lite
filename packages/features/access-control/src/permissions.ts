/**
 * Permission keys seeded by apps/web/supabase/migrations/20260718232603_organizations.sql.
 * Keep in sync with the `public.permissions.key` seed data. Checked via
 * public.has_permission(org_id, key) -- see ./server/has-permission.ts.
 */
export const PERMISSIONS = {
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_ASSIGN_ROLE: 'members.assign_role',
  ORGANIZATIONS_UPDATE: 'organizations.update',
  CLAIMS_CREATE_EDIT: 'claims.create_edit',
  CLAIMS_APPROVE_SUBMIT: 'claims.approve_submit',
  CLAIMS_CORRECT_RESUBMIT: 'claims.correct_resubmit',
  REMITTANCES_VIEW: 'remittances.view',
  REMITTANCES_POST_PAYMENT: 'remittances.post_payment',
  PAYERS_MANAGE: 'payers.manage',
  DOCUMENTS_VIEW_DOWNLOAD: 'documents.view_download',
  SUPPORT_TICKETS_CREATE: 'support.tickets.create',
  ORGANIZATIONS_VIEW_ALL: 'organizations.view_all',
  SUPPORT_ACCESS_SESSION_ENTER: 'support.access_session.enter',
  DATA_EXPORT: 'data.export',
  AUDIT_VIEW: 'audit.view',
  AUDIT_VIEW_OWN: 'audit.view_own',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
