import {
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Store,
  User,
  Users,
  UsersRound,
} from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

const routes = [
  {
    label: 'common:routes.application',
    children: [
      {
        label: 'common:routes.home',
        path: pathsConfig.app.home,
        Icon: <Home className={iconClasses} />,
        end: true,
      },
    ],
  },
  {
    label: 'common:routes.clearinghouse',
    children: [
      {
        label: 'common:routes.dashboard',
        path: pathsConfig.app.dashboard,
        Icon: <LayoutDashboard className={iconClasses} />,
        end: true,
      },
      {
        label: 'common:routes.providers',
        path: pathsConfig.app.providers,
        Icon: <Stethoscope className={iconClasses} />,
      },
      {
        label: 'common:routes.patients',
        path: pathsConfig.app.patients,
        Icon: <UsersRound className={iconClasses} />,
      },
      {
        label: 'common:routes.claims',
        path: pathsConfig.app.claims,
        Icon: <FileText className={iconClasses} />,
      },
      {
        label: 'common:routes.claimBatches',
        path: pathsConfig.app.claimBatches,
        Icon: <Layers className={iconClasses} />,
      },
      {
        label: 'common:routes.remittances',
        path: pathsConfig.app.remittances,
        Icon: <Receipt className={iconClasses} />,
      },
      {
        label: 'common:routes.payers',
        path: pathsConfig.app.payers,
        Icon: <Store className={iconClasses} />,
      },
      {
        label: 'common:routes.documents',
        path: pathsConfig.app.documents,
        Icon: <FolderOpen className={iconClasses} />,
      },
      {
        label: 'common:routes.support',
        path: pathsConfig.app.support,
        Icon: <LifeBuoy className={iconClasses} />,
      },
      {
        label: 'common:routes.users',
        path: pathsConfig.app.users,
        Icon: <Users className={iconClasses} />,
      },
      {
        label: 'common:routes.audit',
        path: pathsConfig.app.audit,
        Icon: <ShieldCheck className={iconClasses} />,
      },
    ],
  },
  {
    label: 'common:routes.settings',
    children: [
      {
        label: 'common:routes.profile',
        path: pathsConfig.app.profileSettings,
        Icon: <User className={iconClasses} />,
      },
    ],
  },
] satisfies z.infer<typeof NavigationConfigSchema>['routes'];

export const navigationConfig = NavigationConfigSchema.parse({
  routes,
  style: process.env.NEXT_PUBLIC_NAVIGATION_STYLE,
  sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
});
