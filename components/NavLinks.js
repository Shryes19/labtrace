'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { section: 'Workspace' },
  { href: '/dashboard', label: 'Dashboard', ico: '◧' },
  { href: '/incidents', label: 'Incidents', ico: '⚠' },
  { href: '/incidents/new', label: 'Report a failure', ico: '+' },
  { href: '/knowledge', label: 'Knowledge base', ico: '⌕' },
  { section: 'Assets' },
  { href: '/equipment', label: 'Equipment', ico: '▣' },
  { href: '/labs', label: 'Laboratories', ico: '⌂' },
  { href: '/parts', label: 'Spare parts', ico: '⚙', roles: ['technician', 'admin'] },
  { section: 'Administration', roles: ['admin'] },
  { href: '/analytics', label: 'Reliability analytics', ico: '▤', roles: ['admin'] },
  { href: '/users', label: 'Users & roles', ico: '☺', roles: ['admin'] },
];

export default function NavLinks({ role }) {
  const path = usePathname();
  const items = LINKS.filter((l) => !l.roles || l.roles.includes(role));
  const activeHref = items.filter((l) => l.href && (path === l.href || path.startsWith(l.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="nav">
      {items.map((l, i) =>
        l.section ? <div key={i} className="nav-section">{l.section}</div> : (
          <Link key={l.href} href={l.href} className={activeHref === l.href ? 'active' : ''}>
            <span className="ico">{l.ico}</span>{l.label}
          </Link>
        ))}
    </nav>
  );
}
