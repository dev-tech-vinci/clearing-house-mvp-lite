export function AdminAccessDenied() {
  return (
    <div
      className={
        'border-destructive/50 text-destructive rounded-md border border-dashed p-8 text-sm'
      }
    >
      <p className={'font-medium'}>Access restricted</p>
      <p className={'mt-2'}>
        This page is only available to Platform Super Admins.
      </p>
    </div>
  );
}
