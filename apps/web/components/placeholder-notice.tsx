import { Trans } from '@kit/ui/trans';

export function PlaceholderNotice() {
  return (
    <div
      className={
        'border-border bg-muted/30 text-muted-foreground rounded-md border border-dashed p-8 text-sm'
      }
    >
      <p className={'font-medium'}>
        <Trans i18nKey={'common:placeholderNoticeTitle'} />
      </p>

      <p className={'mt-2'}>
        <Trans i18nKey={'common:placeholderNoticeDescription'} />
      </p>
    </div>
  );
}
