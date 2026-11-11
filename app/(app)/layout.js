import { requirePageUser } from '@/lib/auth';
import NavLinks from '@/components/NavLinks';
import LogoutButton from '@/components/LogoutButton';

export default async function AppLayout({ children }) {
  const user = await requirePageUser();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LT</div>
          <div><div className="brand-name">LabTrace</div><div className="brand-sub">Lab asset intelligence</div></div>
        </div>
        <NavLinks role={user.role} />
        <div className="side-user">
          <b>{user.name}</b>
          <span className="role-pill">{user.role}</span><br />
          <LogoutButton />
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
