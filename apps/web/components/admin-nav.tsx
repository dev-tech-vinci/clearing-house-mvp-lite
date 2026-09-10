import Link from 'next/link';

const ADMIN_NAV_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/payers', label: 'Payer Directory' },
  { href: '/admin/payer-rules', label: 'Payer Rules' },
];

export function AdminNav() {
  return (
    <nav className={'flex items-center gap-x-4 border-b px-4 py-2'}>
      {ADMIN_NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={'text-muted-foreground hover:text-foreground text-sm font-medium'}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
