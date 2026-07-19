'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ROLES } from '@kit/access-control/roles';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import {
  removeMemberAction,
  revokeInvitationAction,
  updateMemberRoleAction,
} from '../server/server-actions';
import { InviteMemberDialog } from './invite-member-dialog';

export interface OrganizationMemberRow {
  membership_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  role_key: string;
  role_name: string;
  created_at: string;
}

export interface OrganizationInvitationRow {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string | null;
  role: { key: string; name: string } | null;
}

const INVITABLE_ROLE_OPTIONS = [
  { key: ROLES.ORG_ADMIN, label: 'Org Admin' },
  { key: ROLES.CLAIMS_MANAGER, label: 'Claims Manager' },
  { key: ROLES.CLAIMS_SPECIALIST, label: 'Claims Specialist' },
  { key: ROLES.REMITTANCE_SPECIALIST, label: 'Remittance Specialist' },
  { key: ROLES.READ_ONLY_AUDITOR, label: 'Read-Only Auditor' },
];

export function OrganizationMembersPage({
  organizationId,
  members,
  invitations,
  canManageMembers,
}: {
  organizationId: string;
  members: OrganizationMemberRow[];
  invitations: OrganizationInvitationRow[];
  canManageMembers: boolean;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const router = useRouter();

  // Deferred to the next tick so any open Select/dropdown close animation
  // isn't interrupted by the RSC tree refresh landing in the same commit.
  const deferredRefresh = () => setTimeout(() => router.refresh(), 0);

  const updateRoleMutation = useMutation({
    mutationFn: updateMemberRoleAction,
    onSuccess: deferredRefresh,
  });
  const removeMemberMutation = useMutation({
    mutationFn: removeMemberAction,
    onSuccess: deferredRefresh,
  });
  const revokeInvitationMutation = useMutation({
    mutationFn: revokeInvitationAction,
    onSuccess: deferredRefresh,
  });

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  return (
    <div className={'flex flex-col space-y-8'}>
      <div className={'flex items-center justify-between'}>
        <div>
          <h2 className={'text-lg font-medium'}>Members</h2>
          <p className={'text-muted-foreground text-sm'}>
            Everyone with access to this organization. Simulation data only.
          </p>
        </div>

        {canManageMembers && (
          <Button
            data-test={'invite-member-trigger'}
            onClick={() => setInviteOpen(true)}
          >
            Invite member
          </Button>
        )}
      </div>

      <Table data-test={'organization-members-table'}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManageMembers && <TableHead className={'text-right'} />}
          </TableRow>
        </TableHeader>

        <TableBody>
          {members.map((member) => (
            <TableRow key={member.membership_id}>
              <TableCell>{member.name}</TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell>
                {canManageMembers && member.role_key !== ROLES.ORG_OWNER ? (
                  <Select
                    value={member.role_key}
                    onValueChange={(roleKey) => {
                      const promise = updateRoleMutation.mutateAsync({
                        membershipId: member.membership_id,
                        roleKey,
                      });

                      toast.promise(() => promise, {
                        loading: 'Updating role...',
                        success: 'Role updated',
                        error: 'Could not update role',
                      });
                    }}
                  >
                    <SelectTrigger className={'w-48'}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={'outline'}>{member.role_name}</Badge>
                )}
              </TableCell>
              <TableCell>
                {new Date(member.created_at).toLocaleDateString()}
              </TableCell>
              {canManageMembers && (
                <TableCell className={'text-right'}>
                  {member.role_key !== ROLES.ORG_OWNER && (
                    <Button
                      variant={'ghost'}
                      size={'sm'}
                      onClick={() => {
                        const promise = removeMemberMutation.mutateAsync({
                          membershipId: member.membership_id,
                        });

                        toast.promise(() => promise, {
                          loading: 'Removing member...',
                          success: 'Member removed',
                          error: 'Could not remove member',
                        });
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div>
        <h2 className={'text-lg font-medium'}>Pending invitations</h2>
        <p className={'text-muted-foreground text-sm'}>
          Invitations expire seven days after being sent.
        </p>
      </div>

      <Table data-test={'organization-invitations-table'}>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            {canManageMembers && <TableHead className={'text-right'} />}
          </TableRow>
        </TableHeader>

        <TableBody>
          {pendingInvitations.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canManageMembers ? 5 : 4}
                className={'text-muted-foreground'}
              >
                No pending invitations.
              </TableCell>
            </TableRow>
          )}

          {pendingInvitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>{invitation.email}</TableCell>
              <TableCell>{invitation.role?.name}</TableCell>
              <TableCell>
                <Badge variant={'outline'}>{invitation.status}</Badge>
              </TableCell>
              <TableCell>
                {new Date(invitation.expires_at).toLocaleDateString()}
              </TableCell>
              {canManageMembers && (
                <TableCell className={'text-right'}>
                  <Button
                    variant={'ghost'}
                    size={'sm'}
                    onClick={() => {
                      const promise = revokeInvitationMutation.mutateAsync({
                        invitationId: invitation.id,
                      });

                      toast.promise(() => promise, {
                        loading: 'Revoking invitation...',
                        success: 'Invitation revoked',
                        error: 'Could not revoke invitation',
                      });
                    }}
                  >
                    Revoke
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canManageMembers && (
        <InviteMemberDialog
          organizationId={organizationId}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
    </div>
  );
}
