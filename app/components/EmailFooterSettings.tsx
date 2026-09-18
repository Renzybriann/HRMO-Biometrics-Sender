'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { DEFAULT_FOOTER } from '@/lib/email-content';
import type { EmailFooter } from '@/lib/types';

export function EmailFooterSettings({ showToast }: { showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [footer, setFooter] = useState<EmailFooter>(DEFAULT_FOOTER);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/settings/email-footer');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load email footer');
      setFooter({ ...DEFAULT_FOOTER, ...data }); setLoaded(true);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/settings/email-footer', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(footer) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save email footer');
      setFooter(data); showToast('Shared email footer saved', 'success');
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };
  const labels: Record<keyof EmailFooter, string> = { office: 'Office', organization: 'Organization', address: 'Address', phone: 'Phone', email: 'Email', facebook: 'Facebook Page', facebookAccount: 'Facebook Account', confidentialityNotice: 'Confidentiality Notice' };
  return <section style={{ padding: '28px 0', marginTop: 24, borderTop: '1px solid var(--gray-200)' }}>
    <h2 style={{ fontSize: 16, marginBottom: 18 }}>Shared Email Footer</h2>
    {error && <div role="alert" style={{ color: '#b42318', marginBottom: 12 }}>{error} <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading || saving}><RefreshCw size={14} /> Reload</button></div>}
    <fieldset disabled={loading || saving || !loaded} style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {(Object.keys(labels) as (keyof EmailFooter)[]).map(key => <label key={key} className="label">{labels[key]}
        {key === 'address' || key === 'confidentialityNotice' ? <textarea className="textarea" value={footer[key]} maxLength={key === 'confidentialityNotice' ? 10000 : 1000} style={{ minHeight: key === 'confidentialityNotice' ? 180 : 80, fontWeight: 400 }} onChange={e => setFooter({ ...footer, [key]: e.target.value })} /> : <input className="input" value={footer[key]} onChange={e => setFooter({ ...footer, [key]: e.target.value })} />}
      </label>)}
      <button className="btn btn-primary" onClick={save} style={{ alignSelf: 'flex-start' }}>{saving || loading ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} Save Footer</button>
    </fieldset>
  </section>;
}
