'use client';
import { useState } from 'react';
import Link from 'next/link';
import AuthHero from '../AuthHero';

const DEMO = [
  ['Admin', 'admin@labtrace.edu'],
  ['Technician', 'tech@labtrace.edu'],
  ['Student', 'student@labtrace.edu'],
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Login failed');
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next && next.startsWith('/') ? next : '/dashboard';
  }

  return (
    <div className="auth-wrap">
      <AuthHero />
      <div className="auth-form">
        <form className="auth-card" onSubmit={submit}>
          <h1>Sign in</h1>
          <p className="muted">Use your institution email.</p>
          {error && <div className="alert error">{error}</div>}
          <div className="field"><label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
          <div className="field"><label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="small">New student? <Link href="/register">Create an account</Link></p>
          <div className="demo-box">
            <b>Demo accounts</b> (password <code>Password@123</code>)<br />
            {DEMO.map(([r, e]) => (
              <div key={e}>{r}: <button type="button" onClick={() => { setEmail(e); setPassword('Password@123'); }}>{e}</button></div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
