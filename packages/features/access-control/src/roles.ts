/**
 * Role keys seeded by apps/web/supabase/migrations/20260718232603_organizations.sql.
 * Keep in sync with the `public.roles.key` seed data and the role-permission
 * matrix in docs/Behavioral_Health_Clearinghouse_MVP_Technical_Architecture.md.
 */
export const ROLES = {
  PLATFORM_SUPER_ADMIN: 'platform_super_admin',
  SUPPORT_MANAGER: 'support_manager',
  SUPPORT_AGENT: 'support_agent',
  ORG_OWNER: 'org_owner',
  ORG_ADMIN: 'org_admin',
  CLAIMS_MANAGER: 'claims_manager',
  CLAIMS_SPECIALIST: 'claims_specialist',
  REMITTANCE_SPECIALIST: 'remittance_specialist',
  READ_ONLY_AUDITOR: 'read_only_auditor',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

/**
 * Roles assignable via the invite-member UI. org_owner is deliberately
 * excluded -- it is only assigned atomically at organization creation
 * (see public.create_organization). Platform-scoped roles are excluded --
 * they are not organization member roles.
 */
export const INVITABLE_ROLES: RoleKey[] = [
  ROLES.ORG_ADMIN,
  ROLES.CLAIMS_MANAGER,
  ROLES.CLAIMS_SPECIALIST,
  ROLES.REMITTANCE_SPECIALIST,
  ROLES.READ_ONLY_AUDITOR,
];
