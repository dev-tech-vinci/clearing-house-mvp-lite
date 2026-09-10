'use client';

import type { ReactNode } from 'react';

import { Badge } from '@kit/ui/badge';

interface TraceEventRow {
  id: string;
  event_name: string;
  event_category: string;
  occurred_at: string;
  actor_type: string;
  actor_id: string | null;
  claim_id: string;
  batch_id: string | null;
  isa13: string | null;
  gs06: string | null;
  st02: string | null;
  route: string | null;
  request_payload_hash: string | null;
  response_payload_hash: string | null;
  status: string;
  code: string | null;
  explanation: string;
  correlation_id: string;
  previous_event_id: string | null;
  next_recommended_action: string | null;
  payer: { id: string; sim_payer_id: string; display_name: string } | null;
  rule: { id: string; rule_code: string } | null;
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  submitted: 'outline',
  accepted: 'secondary',
  accepted_for_adjudication: 'default',
  rejected: 'destructive',
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return (
    <div className={'flex flex-col'}>
      <span className={'text-muted-foreground text-xs'}>{label}</span>
      <span className={'font-mono text-xs break-all'}>{value}</span>
    </div>
  );
}

/**
 * Renders every trace field named in the architecture doc's "trace event
 * fields (every checkpoint)" list: event name, category, timestamp,
 * actor, claim/batch IDs, ISA13/GS06/ST02, payer, route, request/response
 * hash, status, code, explanation, rule ID, correlation ID, previous
 * event, next recommended action.
 */
export function TransactionTracePanel({ events }: { events: TraceEventRow[] }) {
  if (events.length === 0) {
    return (
      <div
        data-test={'transaction-trace-panel'}
        className={'text-muted-foreground rounded-md border p-4 text-sm'}
      >
        No transaction events yet. Submit the claim to generate a trace.
      </div>
    );
  }

  return (
    <div data-test={'transaction-trace-panel'} className={'flex flex-col space-y-3'}>
      {events.map((event) => (
        <div
          key={event.id}
          data-test={'transaction-trace-event'}
          className={'rounded-md border p-3 text-sm'}
        >
          <div className={'flex items-center justify-between'}>
            <div className={'flex items-center gap-x-2'}>
              <span className={'font-medium'}>{event.event_name}</span>
              <Badge variant={'outline'}>{event.event_category}</Badge>
              <Badge variant={STATUS_VARIANT[event.status] ?? 'outline'}>{event.status}</Badge>
              {event.code && <span className={'text-muted-foreground text-xs'}>{event.code}</span>}
            </div>
            <span className={'text-muted-foreground text-xs'}>
              {new Date(event.occurred_at).toLocaleString()}
            </span>
          </div>

          <p className={'mt-2'}>{event.explanation}</p>

          {event.next_recommended_action && (
            <p className={'text-muted-foreground mt-1 text-xs'}>
              Next: {event.next_recommended_action}
            </p>
          )}

          <div className={'mt-3 grid grid-cols-2 gap-2 md:grid-cols-4'}>
            <Field label={'Actor'} value={`${event.actor_type}${event.actor_id ? ` (${event.actor_id})` : ''}`} />
            <Field label={'Claim ID'} value={event.claim_id} />
            <Field label={'Batch ID'} value={event.batch_id} />
            <Field label={'ISA13'} value={event.isa13} />
            <Field label={'GS06'} value={event.gs06} />
            <Field label={'ST02'} value={event.st02} />
            <Field
              label={'Payer'}
              value={
                event.payer ? `${event.payer.display_name} (${event.payer.sim_payer_id})` : null
              }
            />
            <Field label={'Route'} value={event.route} />
            <Field label={'Request hash'} value={event.request_payload_hash} />
            <Field label={'Response hash'} value={event.response_payload_hash} />
            <Field label={'Rule ID'} value={event.rule ? event.rule.rule_code : null} />
            <Field label={'Correlation ID'} value={event.correlation_id} />
            <Field label={'Previous event'} value={event.previous_event_id} />
          </div>
        </div>
      ))}
    </div>
  );
}
