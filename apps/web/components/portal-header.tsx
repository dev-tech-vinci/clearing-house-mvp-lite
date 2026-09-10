import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';

export function PortalHeader(props: { label: React.ReactNode }) {
  return (
    <div className={'flex w-full flex-1 items-center justify-between'}>
      <div className={'flex items-center space-x-4'}>
        <AppLogo />
        <span className={'text-muted-foreground text-sm font-medium'}>
          {props.label}
        </span>
      </div>

      <div>
        <ProfileAccountDropdownContainer showProfileName={false} />
      </div>
    </div>
  );
}
