'use client';
import { useState } from 'react';
import Link from 'next/link';
import AuthHero from '../AuthHero';

export default function RegisterPage() {
  const [f, setF] = useState({ srn: '', name: '', email: '', password: '', department: 'CSE (AI & ML)' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Registration failed');
    window.location.href = '/dashboard';
  }

  return (
    <div className="auth-wrap">
      <AuthHero />
      <div className="auth-form">
        <form className="auth-card" onSubmit={submit}>
          <h1>Student registration</h1>
          <p className="muted">Technician and admin accounts are created by the lab administrator.</p>
          {error && <div className="alert error">{error}</div>}
          <div className="field"><label>SRN</label><input value={f.srn} onChange={set('srn')} placeholder="PES1UG24AM000" required /></div>
          <div className="field"><label>Full name</label><input value={f.name} onChange={set('name')} required /></div>
          <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set('email')} required /></div>
          <div className="field"><label>Department</label><input value={f.department} onChange={set('department')} /></div>
          <div className="field"><label>Password (min 8 characters)</label><input type="password" value={f.password} onChange={set('password')} required minLength={8} /></div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="small">Already registered? <Link href="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
