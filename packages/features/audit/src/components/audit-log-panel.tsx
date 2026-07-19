import { Badge } from '@kit/ui/badge';

interface AuditEventRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_id: string | null;
  actorName: string | null;
  actorEmail: string | null;
  created_at: string | null;
  metadata: unknown;
}

/**
 * Read-only audit trail viewer. Every row here came from an explicit
 * logAuditEvent() call in a security-sensitive action (role change,
 * support session start/end, document access, claim
 * approval/submission) -- there is nothing else that could have created
 * a row, since audit_events has no trigger-based auto-instrumentation.
 */
export function AuditLogPanel({ events }: { events: AuditEventRow[] }) {
  if (events.length === 0) {
    return (
      <div data-test={'audit-log-panel'} className={'text-muted-foreground text-sm'}>
        No audit events recorded yet.
      </div>
    );
  }

  return (
    <div data-test={'audit-log-panel'} className={'flex flex-col space-y-2'}>
      {events.map((event) => (
        <div
          key={event.id}
          data-test={'audit-log-row'}
          className={'flex items-center justify-between rounded-md border p-3 text-sm'}
        >
          <div className={'flex items-center gap-x-3'}>
            <Badge variant={'outline'}>{event.action}</Badge>
            <span className={'text-muted-foreground text-xs'}>
              {event.actorName ?? event.actorEmail ?? event.actor_id ?? 'system'}
            </span>
            {event.target_type && (
              <span className={'text-muted-foreground text-xs'}>
                {event.target_type}
                {event.target_id ? ` (${event.target_id.slice(0, 8)})` : ''}
              </span>
            )}
          </div>
          <span className={'text-muted-foreground text-xs'}>
            {event.created_at ? new Date(event.created_at).toLocaleString() : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
