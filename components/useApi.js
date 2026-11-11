'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Small helper for client components that call our JSON API routes. */
export function useApi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function call(url, { method = 'POST', body, refresh = true, success } = {}) {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (success) setMessage(success);
      if (refresh) router.refresh();
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { call, busy, error, message, setError, setMessage };
}
