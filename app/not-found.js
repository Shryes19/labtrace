import Link from 'next/link';
export default function NotFound() {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <h1>Not found</h1>
      <p className="muted">This record does not exist, or your role is not allowed to see it.</p>
      <Link className="btn" href="/dashboard">Back to dashboard</Link>
    </div>
  );
}
