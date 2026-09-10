import type { JwtPayload } from '@supabase/supabase-js';

import { OrganizationSwitcherContainer } from '@kit/organizations/components';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarNavigation,
} from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { navigationConfig } from '~/config/navigation.config';
import { Tables } from '~/lib/database.types';

export function HomeSidebar(props: {
  account?: Tables<'accounts'>;
  user: JwtPayload;
}) {
  return (
    <Sidebar collapsible={'icon'}>
      <SidebarHeader className={'justify-center'}>
        <div className={'flex h-16 items-center justify-between space-x-2'}>
          <div>
            <AppLogo className={'max-w-full'} />
          </div>
        </div>

        <OrganizationSwitcherContainer />
      </SidebarHeader>

      <SidebarContent>
        <SidebarNavigation config={navigationConfig} />
      </SidebarContent>

      <SidebarFooter>
        <ProfileAccountDropdownContainer
          user={props.user}
          account={props.account}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
