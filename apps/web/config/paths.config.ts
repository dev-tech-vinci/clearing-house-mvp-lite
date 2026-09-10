import { z } from 'zod';

const PathsSchema = z.object({
  auth: z.object({
    signIn: z.string().min(1),
    signUp: z.string().min(1),
    verifyMfa: z.string().min(1),
    callback: z.string().min(1),
    passwordReset: z.string().min(1),
    passwordUpdate: z.string().min(1),
  }),
  app: z.object({
    home: z.string().min(1),
    profileSettings: z.string().min(1),
    dashboard: z.string().min(1),
    providers: z.string().min(1),
    patients: z.string().min(1),
    claims: z.string().min(1),
    claimBatches: z.string().min(1),
    remittances: z.string().min(1),
    payers: z.string().min(1),
    documents: z.string().min(1),
    support: z.string().min(1),
    users: z.string().min(1),
    audit: z.string().min(1),
    acceptInvitation: z.string().min(1),
    supportPortal: z.string().min(1),
    adminPortal: z.string().min(1),
  }),
});

const pathsConfig = PathsSchema.parse({
  auth: {
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    verifyMfa: '/auth/verify',
    callback: '/auth/callback',
    passwordReset: '/auth/password-reset',
    passwordUpdate: '/update-password',
  },
  app: {
    home: '/home',
    profileSettings: '/home/settings',
    dashboard: '/home/dashboard',
    providers: '/home/providers',
    patients: '/home/patients',
    claims: '/home/claims',
    claimBatches: '/home/claim-batches',
    remittances: '/home/remittances',
    payers: '/home/payers',
    documents: '/home/documents',
    support: '/home/support',
    users: '/home/users',
    audit: '/home/audit',
    acceptInvitation: '/home/invitations/accept',
    supportPortal: '/support',
    adminPortal: '/admin',
  },
} satisfies z.infer<typeof PathsSchema>);

export default pathsConfig;
