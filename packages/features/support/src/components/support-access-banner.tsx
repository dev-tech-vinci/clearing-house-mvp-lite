import { AlertTriangle } from 'lucide-react';

/**
 * Shown prominently on the support portal whenever a support user has an
 * active session against a customer org's data -- the "no silent
 * impersonation" requirement. There is no code path that shows customer
 * data to support staff without this banner being visible at the same
 * time, since both are driven by the same activeSession lookup.
 */
export function SupportAccessBanner({
  reason,
  expiresAt,
}: {
  reason: string;
  expiresAt: string;
}) {
  return (
    <div
      data-test={'support-access-banner'}
      className={
        'flex items-center gap-x-3 rounded-md border border-amber-500 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400'
      }
    >
      <AlertTriangle className={'h-5 w-5 shrink-0'} />
      <div>
        <p className={'font-semibold'}>SUPPORT ACCESS ACTIVE</p>
        <p>
          Reason: {reason} -- expires {new Date(expiresAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
