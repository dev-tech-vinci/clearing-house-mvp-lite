import { Badge } from '@kit/ui/badge';

interface AccessSessionRow {
  id: string;
  reason: string;
  support_user_id: string;
  started_at: string | null;
  expires_at: string;
  ended_at: string | null;
}

/**
 * Customer-visible support-access history -- the "no silent
 * impersonation" requirement that the customer org can always see who
 * accessed their data, when, why, and for how long. Backed by
 * support_access_sessions_read's has_org_access(organization_id) clause,
 * not a separate table.
 */
export function SupportAccessHistory({ sessions }: { sessions: AccessSessionRow[] }) {
  if (sessions.length === 0) {
    return (
      <div data-test={'support-access-history'} className={'text-muted-foreground text-sm'}>
        No support access has ever been granted against your organization.
      </div>
    );
  }

  return (
    <div data-test={'support-access-history'} className={'flex flex-col space-y-2'}>
      {sessions.map((session) => {
        const isActive =
          !session.ended_at && new Date(session.expires_at).getTime() > Date.now();

        return (
          <div
            key={session.id}
            data-test={'support-access-history-row'}
            className={'rounded-md border p-3 text-sm'}
          >
            <div className={'flex items-center justify-between'}>
              <Badge variant={isActive ? 'destructive' : 'outline'}>
                {isActive ? 'Active' : 'Ended'}
              </Badge>
              <span className={'text-muted-foreground text-xs'}>
                {session.started_at ? new Date(session.started_at).toLocaleString() : ''} --{' '}
                {session.ended_at
                  ? new Date(session.ended_at).toLocaleString()
                  : `expires ${new Date(session.expires_at).toLocaleString()}`}
              </span>
            </div>
            <p className={'mt-1'}>{session.reason}</p>
          </div>
        );
      })}
    </div>
  );
}
