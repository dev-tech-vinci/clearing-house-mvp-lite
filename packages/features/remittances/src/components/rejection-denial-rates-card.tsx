interface ClaimOutcomeStats {
  totalSubmitted: number;
  rejectedCount: number;
  rejectionRate: number;
  adjudicatedCount: number;
  deniedCount: number;
  denialRate: number;
}

/**
 * Rejection rate (pre-adjudication) and denial rate (post-adjudication)
 * as two separate metrics, computed from two separate tables
 * (processing_jobs, remittances) -- never merged into one "failure rate."
 * See docs/05-claim-lifecycle.md for the hard rejection-vs-denial rule.
 */
export function RejectionDenialRatesCard({ stats }: { stats: ClaimOutcomeStats }) {
  return (
    <div data-test={'rejection-denial-rates-card'} className={'grid grid-cols-2 gap-4'}>
      <div className={'rounded-md border p-4'}>
        <p className={'text-muted-foreground text-sm'}>Rejection rate</p>
        <p data-test={'rejection-rate-value'} className={'text-2xl font-semibold'}>
          {(stats.rejectionRate * 100).toFixed(1)}%
        </p>
        <p className={'text-muted-foreground text-xs'}>
          {stats.rejectedCount} of {stats.totalSubmitted} submission(s) rejected pre-adjudication
        </p>
      </div>
      <div className={'rounded-md border p-4'}>
        <p className={'text-muted-foreground text-sm'}>Denial rate</p>
        <p data-test={'denial-rate-value'} className={'text-2xl font-semibold'}>
          {(stats.denialRate * 100).toFixed(1)}%
        </p>
        <p className={'text-muted-foreground text-xs'}>
          {stats.deniedCount} of {stats.adjudicatedCount} adjudicated claim(s) denied
        </p>
      </div>
    </div>
  );
}
