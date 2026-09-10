'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { Building2, ChevronsUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';

import { switchOrganizationAction } from '../server/server-actions';
import { CreateOrganizationDialog } from './create-organization-dialog';

export interface OrganizationSwitcherItem {
  id: string;
  name: string;
  roleName: string;
}

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
  className,
}: {
  organizations: OrganizationSwitcherItem[];
  currentOrganizationId: string | null;
  className?: string;
}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const router = useRouter();

  const switchMutation = useMutation({
    mutationFn: switchOrganizationAction,
    // Deferred to the next tick so the dropdown/dialog close animations
    // aren't interrupted by the RSC tree refresh landing in the same commit.
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const current = organizations.find((o) => o.id === currentOrganizationId);

  const onSwitch = (organizationId: string) => {
    if (organizationId === currentOrganizationId) {
      return;
    }

    const promise = switchMutation.mutateAsync({ organizationId });

    toast.promise(() => promise, {
      loading: 'Switching organization...',
      success: 'Organization switched',
      error: 'Could not switch organization',
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-test={'organization-switcher-trigger'}
          className={cn(
            'hover:bg-secondary flex w-full items-center gap-x-2 rounded-md p-2 text-sm transition-colors group-data-[minimized=true]:justify-center',
            className ?? '',
          )}
        >
          <Building2 className={'h-4 w-4 shrink-0'} />

          <span
            className={
              'flex-1 truncate text-left group-data-[minimized=true]:hidden'
            }
          >
            {current?.name ?? 'No organization'}
          </span>

          <ChevronsUpDown
            className={
              'text-muted-foreground h-4 w-4 shrink-0 group-data-[minimized=true]:hidden'
            }
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={'start'}
          className={'w-64'}
          onCloseAutoFocus={(e) => {
            // The dropdown would otherwise return focus to its trigger on
            // close, fighting the create-organization dialog's own focus
            // trap when it opens in the same interaction.
            if (createDialogOpen) {
              e.preventDefault();
            }
          }}
        >
          <DropdownMenuLabel>Your organizations</DropdownMenuLabel>

          <DropdownMenuSeparator />

          {organizations.length === 0 && (
            <div className={'text-muted-foreground px-2 py-1.5 text-sm'}>
              You are not a member of any organization yet.
            </div>
          )}

          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              data-test={'organization-switcher-item'}
              onSelect={() => onSwitch(org.id)}
              className={cn('flex flex-col items-start', {
                'bg-secondary': org.id === currentOrganizationId,
              })}
            >
              <span className={'truncate'}>{org.name}</span>
              <span className={'text-muted-foreground text-xs'}>
                {org.roleName}
              </span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            data-test={'create-organization-trigger'}
            onSelect={() => setCreateDialogOpen(true)}
          >
            <Plus className={'mr-2 h-4 w-4'} />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
