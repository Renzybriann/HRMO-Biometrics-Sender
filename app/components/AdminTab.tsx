'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, RefreshCw, Save, Shield } from 'lucide-react';

export function AdminTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');
  const [senderName, setSenderName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    fetch('/api/admin')
      .then(r => r.json())
      .then(d => {
        setGmailUser(d.gmailUser || '');
        setSenderName(d.gmailFromName || '');
        setHasPassword(d.hasPassword || false);
      });
  }, []);

  const save = async () => {
    if (!gmailUser) { showToast('Gmail address required', 'error'); return; }
    setSaving(true);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmailUser, gmailAppPassword: gmailPass || undefined, gmailFromName: senderName }),
    });
    setSaving(false);
    if (res.ok) {
      showToast('Update your Vercel env vars and redeploy to apply changes.', 'info');
      setGmailPass('');
      setHasPassword(true);
    } else showToast('Failed to save', 'error');
  };

  const test = async () => {
    setTesting(true);
    setConnStatus('idle');
    const res = await fetch('/api/admin/verify');
    const d = await res.json();
    setConnStatus(d.connected ? 'ok' : 'fail');
    setTesting(false);
    showToast(d.connected ? 'Gmail connected!' : 'Connection failed.', d.connected ? 'success' : 'error');
  };

  return (
    <div className="fade-up" style={{ maxWidth: 560 }}>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} color="var(--yellow)" /></div>
          <div><h2 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>Gmail Configuration</h2><p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Configure via <strong>Vercel Environment Variables</strong></p></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label className="label">Sender Name</label><input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. Biometrics Department" /></div>
          <div><label className="label">Gmail Address</label><input className="input" value={gmailUser} onChange={e => setGmailUser(e.target.value)} placeholder="you@gmail.com" type="email" /></div>
          <div>
            <label className="label">App Password {hasPassword && <span className="badge badge-success" style={{ marginLeft: 8 }}>Saved</span>}</label>
            <div style={{ position: 'relative' }}>
              <input className="input" value={gmailPass} onChange={e => setGmailPass(e.target.value)} placeholder={hasPassword ? 'Enter to update' : 'xxxx-xxxx-xxxx-xxxx'} type={showPass ? 'text' : 'password'} style={{ paddingRight: 42 }} />
              <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Generate at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>myaccount.google.com/apppasswords</a></div>
          </div>
        </div>
        {connStatus !== 'idle' && (
          <div className={`slide-down badge ${connStatus === 'ok' ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: 14, padding: '8px 12px', borderRadius: 7, width: '100%', justifyContent: 'flex-start', gap: 7 }}>
            {connStatus === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
            {connStatus === 'ok' ? 'Connection successful!' : 'Failed - check credentials.'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <RefreshCw size={13} className="spin" /> : <Save size={13} />} Save</button>
          <button className="btn btn-ghost" onClick={test} disabled={testing}>{testing ? <RefreshCw size={13} className="spin" /> : <CheckCircle size={13} />} Test Connection</button>
        </div>
      </div>
    </div>
  );
}
