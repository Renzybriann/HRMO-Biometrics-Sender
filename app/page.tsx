'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, Mail, Plus, Trash2, Send, Upload, FileText,
  RefreshCw, CheckCircle, XCircle, Clock, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, X, Edit2, Save, AlertCircle, Paperclip,
  Eye, EyeOff, Shield, Pencil, Info, Minimize2, Maximize2,
  Layers, StopCircle, RotateCcw, Square, CheckSquare, Calendar,
  BookTemplate, Copy, Trash, BookOpen, Link, ExternalLink,LogOut
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Office { id: string; name: string; emails: string[]; createdAt: string; sortOrder: number; }
interface SendLog { id: string; officeId: string; officeName: string; email: string; sentAt: string; status: 'success' | 'failed'; filesCount: number; error?: string; }
interface PDFFile { name: string; size: number; uploadedAt: string; }
interface EmailTemplate { id: string; name: string; subject: string; body: string; isDefault: boolean; createdAt: string; }
interface SchedulerConfig { enabled: boolean; dayOfMonth: number; hour: number; minute: number; }
type QueueStatus = 'idle' | 'running' | 'aborted' | 'done';
interface QueueItem { officeId: string; officeName: string; status: 'pending' | 'sending' | 'sent' | 'failed' | 'retrying'; error?: string; attempt: number; }
interface CutoffLabel { id: string; startDate: string; endDate: string; url: string; createdAt: string; }


// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, '0');

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--blue)';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : Info;
  return (
    <div className="fade-up" style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: bg, color: '#fff', padding: '12px 18px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500, maxWidth: 380 }}>
      <Icon size={16} style={{ flexShrink: 0 }} /><span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={14} /></button>
    </div>
  );
}

// ─── Queue Panel ─────────────────────────────────────────────────────────────
function QueuePanel({ queue, status, countdown, sent, total, onAbort, onClose }: {
  queue: QueueItem[]; status: QueueStatus; countdown: number;
  sent: number; total: number; onAbort: () => void; onClose: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((sent / total) * 100);
  const next = queue.find(q => q.status === 'pending');
  const qColors: Record<string, string> = { pending: 'var(--gray-300)', sending: 'var(--blue)', retrying: 'var(--warning)', sent: 'var(--success)', failed: 'var(--danger)' };
  const qLabels: Record<string, string> = { pending: 'Pending', sending: 'Sending…', retrying: 'Retrying', sent: 'Sent ✓', failed: 'Failed ✗' };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9998, width: 380, background: '#fff', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {status === 'running' && <RefreshCw size={14} color="var(--yellow)" className="spin" />}
        {status === 'done' && <CheckCircle size={14} color="#6ee7b7" />}
        {status === 'aborted' && <StopCircle size={14} color="#fca5a5" />}
        <span style={{ flex: 1, color: '#fff', fontWeight: 700, fontSize: 13 }}>
          {status === 'running' ? 'Sending Queue' : status === 'done' ? 'Complete' : 'Aborted'}
        </span>
        <span style={{ color: 'var(--yellow)', fontSize: 12, fontWeight: 800 }}>{sent}/{total}</span>
        {(status === 'done' || status === 'aborted') && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', marginLeft: 6 }}><X size={14} /></button>}
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--gray-100)', height: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: status === 'aborted' ? 'var(--danger)' : 'var(--blue)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ padding: '4px 16px 0', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-500)' }}>
        <span>{pct}% complete</span><span>{sent} of {total} sent</span>
      </div>

      {/* Items */}
      <div style={{ maxHeight: 200, overflowY: 'auto', margin: '6px 0' }}>
        {queue.map(item => (
          <div key={item.officeId} style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: qColors[item.status], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.officeName}</span>
            {(item.status === 'sending' || item.status === 'retrying') && <RefreshCw size={10} color="var(--blue)" className="spin" />}
            <span style={{ fontSize: 11, color: qColors[item.status], fontWeight: 600, flexShrink: 0 }}>{qLabels[item.status]}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {status === 'running' && countdown > 0 && next && <span style={{ flex: 1, fontSize: 11, color: 'var(--gray-500)' }}>Next: <strong>{next.officeName}</strong> in {countdown}s</span>}
        {status === 'running' && (!next || countdown === 0) && <span style={{ flex: 1, fontSize: 11, color: 'var(--gray-500)' }}>Processing…</span>}
        {status === 'done' && <span style={{ flex: 1, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✓ {queue.filter(q => q.status === 'sent').length} sent · {queue.filter(q => q.status === 'failed').length} failed</span>}
        {status === 'aborted' && <span style={{ flex: 1, fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>Aborted — {queue.filter(q => q.status === 'sent').length} already sent</span>}
        {status === 'running' && <button className="btn btn-danger btn-sm" onClick={onAbort}><StopCircle size={12} /> Abort</button>}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
type Tab = 'offices' | 'templates' | 'scheduler' | 'logs' | 'labels' | 'admin';
function Sidebar({ active, onChange, logCount }: { active: Tab; onChange: (t: Tab) => void; logCount: number }) {
  const items: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'offices', label: 'Offices', icon: <Building2 size={17} /> },
    { id: 'templates', label: 'Templates', icon: <BookOpen size={17} /> },
    { id: 'scheduler', label: 'Scheduler', icon: <Calendar size={17} /> },
    { id: 'logs', label: 'Send History', icon: <Clock size={17} />, badge: logCount },
    { id: 'labels', label: 'Cutoff Labels', icon: <Link size={17} /> },
    { id: 'admin', label: 'Admin', icon: <Shield size={17} /> },
   
  ];
  return (
    <aside style={{ width: 220, background: 'var(--navy)', minHeight: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '28px 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} color="var(--navy)" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Biometrics</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Dashboard</div>
          </div>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {items.map(item => (
          <button key={item.id} onClick={() => onChange(item.id)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 8, border: 'none',
            background: active === item.id ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: active === item.id ? '#fff' : 'rgba(255,255,255,0.55)',
            cursor: 'pointer', fontSize: 13, fontWeight: active === item.id ? 700 : 500,
            fontFamily: 'inherit', marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
          }}>
            <span style={{ opacity: active === item.id ? 1 : 0.7 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge ? <span style={{ background: 'var(--yellow)', color: 'var(--navy)', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99 }}>{item.badge}</span> : null}
            {active === item.id && <div style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--yellow)', flexShrink: 0 }} />}
          </button>
        ))}
      </nav>

      {/* Logout button */}
      <div style={{ padding: '16px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.2)';
            (e.currentTarget as HTMLButtonElement).style.color = '#fca5a5';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
          }}>
          <LogOut size={16} style={{ opacity: 0.7 }} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

// ─── Stable sub-components ───────────────────────────────────────────────────
function EmailList({ emails, onChange }: { emails: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      {emails.map((email, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input className="input" value={email} onChange={e => { const n = [...emails]; n[i] = e.target.value; onChange(n); }} placeholder={`Gmail address${emails.length > 1 ? ` ${i + 1}` : ''}`} type="email" />
          {emails.length > 1 && <button className="btn btn-danger btn-icon" onClick={() => onChange(emails.filter((_, j) => j !== i))}><X size={13} /></button>}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', gap: 4 }} onClick={() => onChange([...emails, ''])}><Plus size={12} /> Add email</button>
    </div>
  );
}

function DragDropPanel({ officeId, files, uploading, onUpload, onDelete, onClickUpload }: {
  officeId: string; files: PDFFile[]; uploading: boolean;
  onUpload: (id: string, files: FileList) => void;
  onDelete: (id: string, name: string) => void;
  onClickUpload: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length > 0) onUpload(officeId, e.dataTransfer.files);
  };

  return (
    <div className="slide-down" style={{ borderTop: '1px solid var(--gray-200)', background: 'var(--gray-50)', padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Files</span>
        <button className="btn btn-navy btn-sm" style={{ fontSize: 11 }} disabled={uploading} onClick={onClickUpload}>
          <Upload size={11} /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={onClickUpload}
        style={{
          border: `2px dashed ${dragging ? 'var(--blue)' : 'var(--gray-200)'}`,
          borderRadius: 6,
          padding: files.length === 0 ? '24px 8px' : '10px',
          textAlign: 'center',
          background: dragging ? 'var(--blue-pale)' : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.15s',
          marginBottom: files.length > 0 ? 8 : 0,
          // Prevent children from blocking pointer events during drag
          pointerEvents: 'all',
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--blue)', fontSize: 11, pointerEvents: 'none' }}>
            <RefreshCw size={12} className="spin" /> Uploading…
          </div>
        ) : dragging ? (
          <div style={{ color: 'var(--blue)', fontSize: 13, fontWeight: 700, pointerEvents: 'none' }}>
            <Upload size={20} style={{ marginBottom: 6 }} />
            <div>Drop to upload</div>
          </div>
        ) : files.length === 0 ? (
          <div style={{ color: 'var(--gray-500)', fontSize: 11, pointerEvents: 'none' }}>
            <Upload size={16} style={{ marginBottom: 4, opacity: 0.4 }} />
            <div>Drag & drop PDFs</div>
            <div style={{ fontSize: 10, color: 'var(--gray-300)', marginTop: 2 }}>or click to browse</div>
          </div>
        ) : (
          <div style={{ color: 'var(--gray-400)', fontSize: 10, pointerEvents: 'none' }}>
            Drop more PDFs or click to browse
          </div>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map(file => (
            <div key={file.name} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 5, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <FileText size={12} color="var(--danger)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <span style={{ fontSize: 10, color: 'var(--gray-300)', flexShrink: 0 }}>{fmt(file.size)}</span>
              <button className="btn btn-danger btn-icon btn-sm" style={{ padding: 3 }} onClick={() => onDelete(officeId, file.name)}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('offices');
  const [offices, setOffices] = useState<Office[]>([]);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [autoSend, setAutoSend] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState('default');
  const [scheduler, setScheduler] = useState<SchedulerConfig>({ enabled: true, dayOfMonth: 15, hour: 8, minute: 0 });
  const [labels, setLabels] = useState<CutoffLabel[]>([]);
  const [scheduledOfficeIds, setScheduledOfficeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [countdown, setCountdown] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [queueSent, setQueueSent] = useState(0);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const abortRef = useRef(false);
  const DELAY_S = 30;

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ msg, type }), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [offRes, setRes, labRes] = await Promise.all([fetch('/api/offices'), fetch('/api/settings'), fetch('/api/labels'),]);
      const [offData, setData, labData] = await Promise.all([offRes.json(), setRes.json(), labRes.json(),]);
      setOffices(offData);
      setLogs(setData.logs || []);
      setAutoSend(setData.autoSendEnabled);
      setTemplates(setData.templates || []);
      setActiveTemplateId(setData.activeTemplateId || 'default');
      setScheduler(setData.scheduler || { enabled: true, dayOfMonth: 15, hour: 8, minute: 0 });
      setScheduledOfficeIds(setData.scheduledOfficeIds || []);
      setLabels(Array.isArray(labData) ? labData : []);
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runCountdown = async (seconds: number) => {
    for (let i = seconds; i > 0; i--) {
      if (abortRef.current) break;
      setCountdown(i);
      await sleep(1000);
    }
    setCountdown(0);
  };

  // Queue-based bulk send with selection support
  const handleSendSelected = async (selectedIds: string[]) => {
    const targets = offices.filter(o => selectedIds.includes(o.id));
    if (targets.length === 0) return;
    abortRef.current = false;
    const initial: QueueItem[] = targets.map(o => ({ officeId: o.id, officeName: o.name, status: 'pending', attempt: 0 }));
    setQueue(initial);
    setQueueSent(0);
    setQueueStatus('running');
    setShowQueue(true);
    let q = [...initial];
    let sentSoFar = 0;

    for (let i = 0; i < q.length; i++) {
      if (abortRef.current) { setQueueStatus('aborted'); break; }
      q[i] = { ...q[i], status: 'sending', attempt: 1 };
      setQueue([...q]);

      let success = false; let lastError = '';
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (abortRef.current) break;
        try {
          const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officeId: q[i].officeId }) });
          const data = await res.json();
          if (data.failed > 0) throw new Error(data.results?.[0]?.error || 'Send failed');
          success = true; break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Unknown error';
          if (attempt < 2 && !abortRef.current) { q[i] = { ...q[i], status: 'retrying', attempt: 2 }; setQueue([...q]); await sleep(5000); }
        }
      }

      q[i] = { ...q[i], status: success ? 'sent' : 'failed', error: success ? undefined : lastError };
      if (success) sentSoFar++;
      setQueueSent(sentSoFar);
      setQueue([...q]);

      if (!abortRef.current && i < q.length - 1) await runCountdown(DELAY_S);
    }

    if (!abortRef.current) setQueueStatus('done');
    await fetchAll();
  };

  

  const handleSendOne = async (officeId: string) => {
    setSendingId(officeId);
    try {
      const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officeId }) });
      const data = await res.json();
      await fetchAll();
      if (data.failed > 0) showToast(`Failed: ${data.results?.[0]?.error || 'Unknown'}`, 'error');
      else showToast('Email sent!', 'success');
    } catch { showToast('Send failed. Check Admin.', 'error'); }
    finally { setSendingId(null); }
  };

  const handleToggleAutoSend = async () => {
    const v = !autoSend; setAutoSend(v);
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoSendEnabled: v }) });
    showToast(`Auto-send ${v ? 'enabled' : 'disabled'}`, 'info');
  };

  const isQueueRunning = queueStatus === 'running';
  const sentCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const queueMap = Object.fromEntries(queue.map(q => [q.officeId, q]));
  const activeTemplate = templates.find(t => t.id === activeTemplateId) ?? templates[0];

  const tabTitles: Record<Tab, string> = { offices: 'Office Management', templates: 'Email Templates', scheduler: 'Scheduler', logs: 'Send History', labels: 'Cutoff Labels', admin: 'Admin' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showQueue && <QueuePanel queue={queue} status={queueStatus} countdown={countdown} sent={queueSent} total={queue.length} onAbort={() => { abortRef.current = true; }} onClose={() => { setShowQueue(false); setQueue([]); setQueueStatus('idle'); setQueueSent(0); }} />}
      <Sidebar active={tab} onChange={setTab} logCount={logs.length} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ background: '#fff', borderBottom: '1px solid var(--gray-200)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--navy)' }}>{tabTitles[tab]}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={handleToggleAutoSend} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray-200)', background: autoSend ? 'var(--blue-pale)' : 'var(--gray-100)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: autoSend ? 'var(--blue)' : 'var(--gray-500)', transition: 'all 0.15s' }}>
              {autoSend ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} Auto-send {autoSend ? 'ON' : 'OFF'}
            </button>
            {isQueueRunning
              ? <button className="btn btn-danger btn-sm" onClick={() => { abortRef.current = true; }}><StopCircle size={13} /> Abort</button>
              : null}
          </div>
        </header>

        {/* Stats strip */}
        {tab === 'offices' && (
          <div style={{ background: 'var(--navy-800)', padding: '12px 32px', display: 'flex', gap: 28, alignItems: 'center' }}>
            {[{ label: 'Offices', value: offices.length, color: '#fff' }, { label: 'Sent', value: sentCount, color: 'var(--success)' }, { label: 'Failed', value: failedCount, color: '#fc8181' }].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
              </div>
            ))}
            {isQueueRunning && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={12} color="var(--yellow)" className="spin" />
                <span style={{ color: 'var(--yellow)', fontSize: 12, fontWeight: 700 }}>{queueSent}/{queue.length} sent</span>
                {/* Inline mini progress */}
                <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${queue.length ? (queueSent / queue.length) * 100 : 0}%`, background: 'var(--yellow)', borderRadius: 99, transition: 'width 0.3s' }} />
                </div>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setShowQueue(true)}>View</button>
              </div>
            )}
          </div>
        )}

        <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--gray-500)', gap: 10 }}>
              <RefreshCw size={18} className="spin" /> Loading…
            </div>
          ) : (
            <>
              {tab === 'offices' && <OfficesTab offices={offices} sendingId={sendingId} queueMap={queueMap} templates={templates} activeTemplateId={activeTemplateId} onSendOne={handleSendOne} onSendSelected={handleSendSelected} onRefresh={fetchAll} showToast={showToast} />}
              {tab === 'templates' && <TemplatesTab templates={templates} activeTemplateId={activeTemplateId} setActiveTemplateId={setActiveTemplateId} onRefresh={fetchAll} showToast={showToast} />}
              {tab === 'scheduler' && <SchedulerTab scheduler={scheduler} setScheduler={setScheduler} autoSend={autoSend} onToggleAutoSend={handleToggleAutoSend} scheduledOfficeIds={scheduledOfficeIds} setScheduledOfficeIds={setScheduledOfficeIds} offices={offices} showToast={showToast} />}
              {tab === 'logs' && <LogsTab logs={logs} />}
              {tab === 'labels' && <LabelsTab labels={labels} onRefresh={fetchAll} showToast={showToast} />}
              {tab === 'admin' && <AdminTab showToast={showToast} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Offices Tab ─────────────────────────────────────────────────────────────
function OfficesTab({ offices, sendingId, queueMap, templates, activeTemplateId, onSendOne, onSendSelected, onRefresh, showToast }: {
  offices: Office[]; sendingId: string | null; queueMap: Record<string, QueueItem>;
  templates: EmailTemplate[]; activeTemplateId: string;
  onSendOne: (id: string) => void; onSendSelected: (ids: string[]) => void;
  onRefresh: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmails, setFormEmails] = useState<string[]>(['']);
  const [formError, setFormError] = useState('');
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [pdfMap, setPdfMap] = useState<Record<string, PDFFile[]>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeUploadId = useRef<string>('');

  // Bulk controls
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPdfs, setOpenPdfs] = useState<Set<string>>(new Set());
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const allCollapsed = offices.length > 0 && collapsedCards.size === offices.length;
  const allSelected = offices.length > 0 && selected.size === offices.length;

  const fetchPDFs = async (id: string) => {
    const res = await fetch(`/api/upload?officeId=${id}`);
    const d = await res.json();
    setPdfMap(p => ({ ...p, [id]: d.files || [] }));
  };

// Auto-fetch PDFs for ALL offices on mount
// and auto-open the PDF panel for offices with no attachments
useEffect(() => {
  offices.forEach(async (o) => {
    await fetchPDFs(o.id);
  });
}, [offices.length]);

useEffect(() => {
  const noAttachment = offices.filter(o => pdfMap[o.id] !== undefined && pdfMap[o.id].length === 0);
  if (noAttachment.length > 0) {
    setOpenPdfs(prev => {
      const next = new Set(prev);
      noAttachment.forEach(o => next.add(o.id));
      return next;
    });
  }
}, [pdfMap]);

  const togglePdf = async (id: string) => {
    const next = new Set(openPdfs);
    if (next.has(id)) { next.delete(id); } else { next.add(id); if (!pdfMap[id]) await fetchPDFs(id); }
    setOpenPdfs(next);
  };

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsedCards);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCollapsedCards(next);
  };

  const toggleCollapseAll = () => {
    if (allCollapsed) { setCollapsedCards(new Set()); }
    else { setCollapsedCards(new Set(offices.map(o => o.id))); }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(offices.map(o => o.id)));
  };

const resetForm = () => { setFormName(''); setFormEmails(['']); setFormError(''); setFormSortOrder(0); };

  const saveOffice = async (isEdit: boolean, officeId?: string) => {
  setFormError('');
  const cleanEmails = formEmails.map(e => e.trim()).filter(Boolean);
  if (!formName.trim() || cleanEmails.length === 0) { setFormError('Name and at least one email required.'); return; }
  const method = isEdit ? 'PUT' : 'POST';
  const body = isEdit 
    ? { id: officeId, name: formName.trim(), emails: cleanEmails, sortOrder: formSortOrder } // ← ADD sortOrder
    : { name: formName.trim(), emails: cleanEmails };
  const res = await fetch('/api/offices', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json(); setFormError(e.error || 'Failed'); return; }
  resetForm(); setShowAdd(false); setEditId(null);
  await onRefresh();
  showToast(isEdit ? 'Office updated' : 'Office added', 'success');
};

  const deleteOffice = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/offices?id=${id}`, { method: 'DELETE' });
    await onRefresh();
    showToast('Office deleted', 'info');
  };

  const uploadPDFs = async (officeId: string, files: FileList) => {
  setUploadingId(officeId);
  const fd = new FormData();
  fd.append('officeId', officeId);
  for (const f of Array.from(files)) fd.append('files', f);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  await fetchPDFs(officeId);
  setUploadingId(null);
  showToast(`${data.count} file(s) uploaded`, 'success');
};

  const deletePDF = async (officeId: string, fileName: string) => {
    await fetch(`/api/upload?officeId=${officeId}&file=${encodeURIComponent(fileName)}`, { method: 'DELETE' });
    await fetchPDFs(officeId);
    showToast('File removed', 'info');
  };

  const qColors: Record<string, string> = { pending: 'var(--gray-300)', sending: 'var(--blue)', retrying: 'var(--warning)', sent: 'var(--success)', failed: 'var(--danger)' };

  const selectedIds = Array.from(selected);

  return (
    <div className="fade-up">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={toggleSelectAll} style={{ gap: 6 }}>
          {allSelected ? <CheckSquare size={13} color="var(--blue)" /> : <Square size={13} />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>

        <button className="btn btn-ghost btn-sm" onClick={toggleCollapseAll}>
          {allCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          {allCollapsed ? 'Expand All' : 'Collapse All'}
        </button>

        {/* replaces the old Show All Attachments button */}
        <button className="btn btn-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', gap: 6 }}
          onClick={async () => {
            if (!confirm('Clear ALL attachments for every office?')) return;
            const res = await fetch('/api/upload?clearGlobal=true', { method: 'DELETE' });
            if (res.ok) {
              offices.forEach(o => fetchPDFs(o.id));
              showToast('All attachments cleared', 'info');
            } else showToast('Failed to clear attachments', 'error');
          }}>
          <Trash2 size={13} /> Clear All Attachments
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <button className="btn btn-yellow btn-sm" onClick={() => onSendSelected(selectedIds)}>
              <Send size={13} /> Send Selected ({selected.size})
            </button>
          )}
          <button className="btn btn-navy btn-sm" onClick={() => { resetForm(); setShowAdd(true); setEditId(null); }}>
            <Plus size={13} /> Add Office
          </button>
        </div>
      </div>
      {/* Selected banner */}
      {selected.size > 0 && (
        <div className="slide-down" style={{ background: 'var(--blue-pale)', border: '1px solid var(--blue)', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckSquare size={14} color="var(--blue)" />
          <span style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>{selected.size} office{selected.size > 1 ? 's' : ''} selected</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}><X size={12} /> Clear</button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card slide-down" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--navy)' }}>New Office</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}><label className="label">Office Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Human Resource Office" /></div>
            <div style={{ flex: '2 1 280px' }}><label className="label">Email Address(es)</label><EmailList emails={formEmails} onChange={setFormEmails} /></div>
          </div>
          {formError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => saveOffice(false)}><Save size={13} /> Save</button>
            <button className="btn btn-ghost" onClick={() => { setShowAdd(false); resetForm(); }}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {offices.length === 0 && !showAdd && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <Building2 size={40} style={{ color: 'var(--gray-300)', marginBottom: 12 }} />
          <div style={{ color: 'var(--gray-500)', fontSize: 14 }}>No offices yet.</div>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {offices.map((office, i) => {
          const isCollapsed = collapsedCards.has(office.id);
          const isPdfOpen = openPdfs.has(office.id);
          const qItem = queueMap[office.id];
          const isSending = sendingId === office.id || qItem?.status === 'sending' || qItem?.status === 'retrying';
          const isSelected = selected.has(office.id);
          const pdfs = pdfMap[office.id];
          const hasPdfs = pdfs && pdfs.length > 0;
          const pdfsLoaded = pdfs !== undefined;

          // Card border color based on attachment state
          const cardBorder = pdfsLoaded
            ? hasPdfs ? '2px solid #3b8de0' : '2px solid var(--danger)'
            : '1px solid var(--gray-200)';

          return (
            <div key={office.id} className={`card fade-up d${Math.min(i + 1, 5)}`}
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', border: isSelected ? '2px solid var(--blue)' : cardBorder, transition: 'border 0.15s', position: 'relative' }}>

              {/* Selection checkbox */}
              <button onClick={() => toggleSelect(office.id)}
                style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? 'var(--yellow)' : 'rgba(255,255,255,0.6)', display: 'flex' }}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>

              {editId === office.id ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div><label className="label">Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} /></div>
                <div><label className="label">Email(s)</label><EmailList emails={formEmails} onChange={setFormEmails} /></div>
                <div>
                  <label className="label">Send Order</label>
                  <input className="input" type="number" min={1} value={formSortOrder}
                    onChange={e => setFormSortOrder(Number(e.target.value))}
                    placeholder="1 = first to send" />
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 3 }}>Lower number = sent first</div>
                </div>
                {formError && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{formError}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => saveOffice(true, office.id)}><Save size={12} /> Save</button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditId(null); resetForm(); }}><X size={13} /></button>
                </div>
              </div>
              ) : (
                <>
                  {/* Card header */}
                  <div style={{ background: 'linear-gradient(135deg, var(--navy-700), var(--navy))', padding: '14px 12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 20 }}>
                      <Building2 size={16} color="var(--yellow)" />
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {qItem && <div title={qItem.status} style={{ width: 7, height: 7, borderRadius: '50%', background: qColors[qItem.status], alignSelf: 'center', marginRight: 2 }} />}
                      <button className="btn btn-icon btn-sm" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: 6 }} onClick={() => toggleCollapse(office.id)}>
                        {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                      </button>
                      <button className="btn btn-icon btn-sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6 }}
                        onClick={() => { setEditId(office.id); setFormName(office.name); setFormEmails([...(office.emails ?? [''])]); setFormError('');  setFormSortOrder(office.sortOrder ?? 0); }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="btn btn-icon btn-sm" style={{ background: 'rgba(220,38,38,0.25)', color: '#fca5a5', borderRadius: 6 }} onClick={() => deleteOffice(office.id, office.name)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Collapsed */}
                  {isCollapsed ? (
                  <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 6 }} onClick={() => toggleCollapse(office.id)}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{office.sortOrder}</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--navy)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{office.name}</span>
                    {qItem && <span style={{ fontSize: 10, fontWeight: 700, color: qColors[qItem.status] }}>{qItem.status}</span>}
                  </div>
                  ) : (
                    <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>{office.sortOrder}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', lineHeight: 1.3 }}>{office.name}</div>
                      </div>

                      {/* Queue status */}
                      {qItem && qItem.status !== 'pending' && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: qColors[qItem.status], background: `${qColors[qItem.status]}18`, padding: '3px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {qItem.status === 'sending' && <><RefreshCw size={9} className="spin" />Sending…</>}
                          {qItem.status === 'retrying' && <><RotateCcw size={9} />Retry {qItem.attempt}…</>}
                          {qItem.status === 'sent' && <><CheckCircle size={9} />Sent</>}
                          {qItem.status === 'failed' && <><XCircle size={9} />Failed</>}
                        </div>
                      )}

                      {/* Emails */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(office.emails ?? []).map((email, ei) => (
                          <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--gray-500)', overflow: 'hidden' }}>
                            <Mail size={9} color="var(--blue)" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                          </div>
                        ))}
                      </div>

                      {/* Attachment indicator */}
                      {/* Attachment indicator + clear per office */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button className="btn btn-ghost btn-sm" style={{
                          flex: 1, justifyContent: 'flex-start', gap: 5, fontSize: 11, padding: '4px 8px',
                          color: pdfsLoaded ? (hasPdfs ? 'var(--blue)' : 'var(--danger)') : 'var(--gray-400)',
                          fontWeight: pdfsLoaded && !hasPdfs ? 700 : 500,
                        }} onClick={() => togglePdf(office.id)}>
                          <Paperclip size={10} />
                          {pdfsLoaded
                            ? hasPdfs
                              ? `${pdfs.length} attachment${pdfs.length > 1 ? 's' : ''}`
                              : '⚠ No attachments'
                            : <RefreshCw size={9} className="spin" />}
                          {isPdfOpen ? <ChevronUp size={10} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={10} style={{ marginLeft: 'auto' }} />}
                        </button>

                        {/* Per-office clear — only shows if files exist */}
                        {hasPdfs && (
                          <button
                            title="Clear attachments for this office"
                            className="btn btn-icon btn-sm"
                            style={{ color: 'var(--danger)', background: 'var(--danger-bg)', flexShrink: 0 }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Clear all attachments for "${office.name}"?`)) return;
                              const res = await fetch(`/api/upload?officeId=${office.id}&clearOffice=true`, { method: 'DELETE' });
                              if (res.ok) { await fetchPDFs(office.id); showToast('Attachments cleared', 'info'); }
                              else showToast('Failed to clear', 'error');
                            }}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      {/* Send */}
                      <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 'auto' }}
                        disabled={isSending || !!qItem} onClick={() => onSendOne(office.id)}>
                        {isSending ? <RefreshCw size={12} className="spin" /> : <Send size={12} />}
                        {qItem ? (qItem.status === 'sent' ? 'Sent ✓' : qItem.status === 'failed' ? 'Failed ✗' : qItem.status === 'pending' ? 'Queued' : 'Sending…') : 'Send Report'}
                      </button>
                    </div>
                  )}

                  {/* PDF panel */}
                  {!isCollapsed && isPdfOpen && (
                    <DragDropPanel officeId={office.id} files={pdfMap[office.id] ?? []} uploading={uploadingId === office.id}
                      onUpload={uploadPDFs} onDelete={deletePDF}
                      onClickUpload={() => { activeUploadId.current = office.id; fileRef.current?.click(); }} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
        onChange={e => { if (e.target.files) uploadPDFs(activeUploadId.current, e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────
function TemplatesTab({ templates, activeTemplateId, setActiveTemplateId, onRefresh, showToast }: {
  templates: EmailTemplate[]; activeTemplateId: string;
  setActiveTemplateId: (id: string) => void;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = templates.find(t => t.id === (editId ?? '')) ?? null;

  const openEdit = (t: EmailTemplate) => { setEditId(t.id); setFormName(t.name); setFormSubject(t.subject); setFormBody(t.body); setShowNew(false); setPreview(false); };
  const openNew = () => { setEditId(null); setFormName(''); setFormSubject(''); setFormBody(''); setShowNew(true); setPreview(false); };

  const saveTemplate = async (isNew: boolean) => {
    if (!formName || !formSubject || !formBody) { showToast('All fields required', 'error'); return; }
    setSaving(true);
    const method = isNew ? 'POST' : 'PUT';
    const body = isNew ? { name: formName, subject: formSubject, body: formBody } : { id: editId, name: formName, subject: formSubject, body: formBody };
    const res = await fetch('/api/settings', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { showToast(isNew ? 'Template created' : 'Template saved', 'success'); setShowNew(false); setEditId(null); await onRefresh(); }
    else showToast('Failed to save', 'error');
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/settings?id=${id}`, { method: 'DELETE' });
    if (editId === id) setEditId(null);
    await onRefresh();
    showToast('Template deleted', 'info');
  };

  const setActive = async (id: string) => {
    setActiveTemplateId(id);
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeTemplateId: id }) });
    showToast('Active template updated', 'success');
  };

  const previewText = (text: string) =>
    text.replace(/\{\{officeName\}\}/g, 'Human Resource Office')
        .replace(/\{\{month\}\}/g, new Date().toLocaleString('default', { month: 'long', year: 'numeric' }))
        .replace(/\{\{senderName\}\}/g, 'Biometrics Department');

  const renderPreview = (text: string) =>
    text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:10px 0"/>')
        .split('\n').map(l => l.trim() === '' ? '<br/>' : `<p style="margin:0 0 5px;font-size:13px;line-height:1.7;">${l}</p>`).join('');

  const wrapSelection = (before: string, after: string) => {
    const ta = textareaRef.current; if (!ta) return;
    const s = ta.selectionStart; const e = ta.selectionEnd;
    setFormBody(formBody.substring(0, s) + before + formBody.substring(s, e) + after + formBody.substring(e));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + before.length, e + before.length); }, 0);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current; if (!ta) return;
    const s = ta.selectionStart;
    setFormBody(formBody.substring(0, s) + text + formBody.substring(s));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + text.length, s + text.length); }, 0);
  };

  const placeholders = ['{{officeName}}', '{{month}}', '{{senderName}}'];

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Template list */}
      <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-navy btn-sm" style={{ width: '100%', marginBottom: 4 }} onClick={openNew}><Plus size={13} /> New Template</button>
        {templates.map(t => (
          <div key={t.id} className="card" style={{ padding: '10px 12px', cursor: 'pointer', border: (editId === t.id || (!editId && !showNew && t.id === activeTemplateId)) ? '2px solid var(--blue)' : '1px solid var(--gray-200)' }}
            onClick={() => openEdit(t)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <BookOpen size={13} color={t.id === activeTemplateId ? 'var(--blue)' : 'var(--gray-500)'} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              {t.id === activeTemplateId && <span className="badge badge-blue" style={{ fontSize: 9 }}>Active</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
          </div>
        ))}
      </div>

      {/* Editor panel */}
      <div className="card" style={{ flex: 1, padding: 24 }}>
        {!editId && !showNew ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>
            <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>Select a template to edit or create a new one.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy)' }}>{showNew ? 'New Template' : 'Edit Template'}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {editId && editId !== 'default' && !templates.find(t => t.id === editId)?.isDefault && (
                  <button className="btn btn-danger btn-sm" onClick={() => deleteTemplate(editId)}><Trash size={12} /> Delete</button>
                )}
                {editId && editId !== activeTemplateId && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setActive(editId)}><CheckCircle size={12} /> Set Active</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setPreview(!preview)}>
                  {preview ? <EyeOff size={12} /> : <Eye size={12} />} {preview ? 'Edit' : 'Preview'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => saveTemplate(showNew)} disabled={saving}>
                  {saving ? <RefreshCw size={12} className="spin" /> : <Save size={12} />} Save
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="label">Template Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Monthly Biometrics" /></div>

              {/* Placeholders */}
              <div style={{ background: 'var(--blue-pale)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Insert:</span>
                {placeholders.map(p => (
                  <button key={p} onClick={() => insertAtCursor(p)}
                    style={{ background: '#fff', color: 'var(--blue)', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid rgba(29,111,206,0.2)', cursor: 'pointer', fontFamily: 'monospace' }}>{p}</button>
                ))}
              </div>

              <div><label className="label">Subject</label>
                {preview ? <div style={{ padding: '9px 12px', background: 'var(--gray-50)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600 }}>{previewText(formSubject)}</div>
                  : <input className="input" value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder="Email subject…" />}
              </div>

              <div><label className="label">Body</label>
                {!preview && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4, padding: '5px 8px', background: 'var(--gray-100)', borderRadius: '6px 6px 0 0', border: '1.5px solid var(--gray-200)', borderBottom: 'none' }}>
                    {[{ l: 'B', s: { fontWeight: 800 as const }, a: () => wrapSelection('**', '**') }, { l: 'I', s: { fontStyle: 'italic' as const }, a: () => wrapSelection('*', '*') }, { l: '—', s: {}, a: () => insertAtCursor('\n---\n') }].map(b => (
                      <button key={b.l} onClick={b.a} style={{ ...b.s, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 4, width: 26, height: 24, cursor: 'pointer', fontSize: 12, color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>{b.l}</button>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--gray-300)', alignSelf: 'center', marginLeft: 6 }}>**bold** · *italic* · --- divider</span>
                  </div>
                )}
                {preview
                  ? <div style={{ padding: 14, background: 'var(--gray-50)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', minHeight: 160 }} dangerouslySetInnerHTML={{ __html: renderPreview(previewText(formBody)) }} />
                  : <textarea ref={textareaRef} className="textarea" value={formBody} onChange={e => setFormBody(e.target.value)} style={{ minHeight: 220, borderRadius: '0 0 6px 6px' }} />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Scheduler Tab ────────────────────────────────────────────────────────────
// ─── Scheduler Tab ────────────────────────────────────────────────────────────
function SchedulerTab({ scheduler, setScheduler, autoSend, onToggleAutoSend, scheduledOfficeIds, setScheduledOfficeIds, offices, showToast }: {
  scheduler: SchedulerConfig;
  setScheduler: (s: SchedulerConfig) => void;
  autoSend: boolean;
  onToggleAutoSend: () => void;
  scheduledOfficeIds: string[];
  setScheduledOfficeIds: (ids: string[]) => void;
  offices: Office[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [local, setLocal] = useState(scheduler);
  const [localIds, setLocalIds] = useState<string[]>(scheduledOfficeIds);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'schedule' | 'offices'>('schedule');

  useEffect(() => { setLocal(scheduler); }, [scheduler]);
  useEffect(() => { setLocalIds(scheduledOfficeIds); }, [scheduledOfficeIds]);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduler: local, scheduledOfficeIds: localIds }),
    });
    setSaving(false);
    if (res.ok) {
      setScheduler(local);
      setScheduledOfficeIds(localIds);
      showToast('Scheduler settings saved', 'success');
    } else showToast('Failed to save', 'error');
  };

  const nextRunDate = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), local.dayOfMonth, local.hour, local.minute);
  
  // If this month's scheduled time hasn't passed yet, show it
  // If it has passed, show next month
  const target = d.getTime() > now.getTime()
    ? d
    : new Date(now.getFullYear(), now.getMonth() + 1, local.dayOfMonth, local.hour, local.minute);

  return target.toLocaleString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

  const ordinal = (n: number) => { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };
  const pad = (n: number) => String(n).padStart(2, '0');

  const toggleOffice = (id: string) => {
  if (noneSelected) {
    // Start fresh with just this one selected
    setLocalIds([id]);
    return;
  }
  const current = localIds.length === 0 ? offices.map(o => o.id) : [...localIds];
  if (current.includes(id)) {
    const next = current.filter(i => i !== id);
    if (next.length === 0) { setLocalIds(['__none__']); return; }
    setLocalIds(next.length === offices.length ? [] : next);
  } else {
    const next = [...current, id];
    setLocalIds(next.length === offices.length ? [] : next);
  }
};

  const noneSelected = localIds.length === 1 && localIds[0] === '__none__';
  const isOfficeSelected = (id: string) => !noneSelected && (localIds.length === 0 || localIds.includes(id));
  const selectedCount = noneSelected ? 0 : localIds.length === 0 ? offices.length : localIds.length;

  return (
    <div className="fade-up" style={{ maxWidth: 620 }}>
      <div className="card" style={{ padding: 28 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color="var(--yellow)" />
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>Auto-Send Schedule</h2>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Configure when and to whom emails are automatically sent.</p>
          </div>
        </div>

        {/* Auto-send toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: autoSend ? 'var(--blue-pale)' : 'var(--gray-100)', borderRadius: 8, marginBottom: 20, cursor: 'pointer' }}
          onClick={onToggleAutoSend}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: autoSend ? 'var(--blue)' : 'var(--gray-700)' }}>Auto-Send</div>
            <div style={{ fontSize: 12, color: autoSend ? 'var(--blue)' : 'var(--gray-500)', marginTop: 2 }}>
              {autoSend ? 'Emails will be sent automatically on schedule' : 'Auto-send is disabled — manual only'}
            </div>
          </div>
          {autoSend ? <ToggleRight size={28} color="var(--blue)" /> : <ToggleLeft size={28} color="var(--gray-400)" />}
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--gray-100)', borderRadius: 8, padding: 4 }}>
          {(['schedule', 'offices'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)} style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: activeSection === s ? '#fff' : 'transparent',
              color: activeSection === s ? 'var(--navy)' : 'var(--gray-500)',
              fontWeight: activeSection === s ? 700 : 500, fontSize: 13, fontFamily: 'inherit',
              boxShadow: activeSection === s ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {s === 'schedule' ? '🕐 Schedule' : `🏢 Offices (${selectedCount}/${offices.length})`}
            </button>
          ))}
        </div>

        {/* ── Schedule section ── */}
        {activeSection === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: autoSend ? 1 : 0.5, pointerEvents: autoSend ? 'all' : 'none' }}>
            <div>
              <label className="label">Day of Month</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min={1} max={31} value={local.dayOfMonth}
                  onChange={e => setLocal({ ...local, dayOfMonth: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--blue)' }} />
                <div style={{ width: 56, textAlign: 'center', fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>
                  {ordinal(local.dayOfMonth)}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Time</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Hour (0–23)</div>
                  <input type="number" min={0} max={23} className="input" value={local.hour}
                    onChange={e => setLocal({ ...local, hour: Math.max(0, Math.min(23, +e.target.value)) })} />
                </div>
                <div style={{ fontSize: 20, color: 'var(--gray-300)', paddingTop: 18 }}>:</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Minute (0–59)</div>
                  <input type="number" min={0} max={59} className="input" value={local.minute}
                    onChange={e => setLocal({ ...local, minute: Math.max(0, Math.min(59, +e.target.value)) })} />
                </div>
                <div style={{ paddingTop: 18, fontSize: 14, fontWeight: 800, color: 'var(--navy)', flexShrink: 0 }}>
                  {pad(local.hour)}:{pad(local.minute)}
                </div>
              </div>
            </div>

            {/* Next run preview */}
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Next Scheduled Run</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{nextRunDate()}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
                Cron: <code style={{ fontSize: 11 }}>{local.minute} {local.hour} {local.dayOfMonth} * *</code>
              </div>
            </div>
          </div>
        )}

        {/* ── Offices section ── */}
        {activeSection === 'offices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                Select which offices receive scheduled emails. Empty = all offices.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setLocalIds([])}>
                  Select All
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setLocalIds(['__none__'])}>
                  Deselect All
                </button>
              </div>
            </div>

            {offices.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                No offices added yet.
              </div>
            ) : (
              offices.map(office => {
                const selected = isOfficeSelected(office.id);
                return (
                  <div key={office.id} onClick={() => toggleOffice(office.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 8, border: `1.5px solid ${selected ? 'var(--blue)' : 'var(--gray-200)'}`,
                    background: selected ? 'var(--blue-pale)' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      border: `2px solid ${selected ? 'var(--blue)' : 'var(--gray-300)'}`,
                      background: selected ? 'var(--blue)' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {selected && <CheckCircle size={11} color="#fff" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>{office.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                        {office.emails.join(', ')}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: selected ? 'var(--blue)' : 'var(--gray-100)',
                      color: selected ? '#fff' : 'var(--gray-400)',
                    }}>
                      {selected ? 'Scheduled' : 'Excluded'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 24, width: '100%' }} onClick={save} disabled={saving}>
          {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} Save Scheduler Settings
        </button>
      </div>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab({ logs }: { logs: SendLog[] }) {
  return (
    <div className="fade-up">
      {logs.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}><Clock size={36} style={{ color: 'var(--gray-300)', marginBottom: 12 }} /><div style={{ color: 'var(--gray-500)' }}>No send history yet.</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map((log, i) => (
            <div key={log.id} className={`card fade-up d${Math.min(i + 1, 5)}`} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: log.status === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {log.status === 'success' ? <CheckCircle size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{log.officeName}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{log.email}</div>
                {log.error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2, fontWeight: 500 }}>⚠ {log.error}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{log.status === 'success' ? 'Sent' : 'Failed'}</span>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{log.filesCount} file{log.filesCount !== 1 ? 's' : ''} · {fmtDate(log.sentAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Admin Tab ────────────────────────────────────────────────────────────────
function AdminTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');
  const [senderName, setSenderName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => { fetch('/api/admin').then(r => r.json()).then(d => { setGmailUser(d.gmailUser || ''); setSenderName(d.gmailFromName || ''); setHasPassword(d.hasPassword || false); }); }, []);

  const save = async () => {
    if (!gmailUser) { showToast('Gmail address required', 'error'); return; }
    setSaving(true);
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gmailUser, gmailAppPassword: gmailPass || undefined, gmailFromName: senderName }) });
    setSaving(false);
    if (res.ok) { showToast('Update your Vercel env vars and redeploy to apply changes.', 'info');setGmailPass(''); setHasPassword(true); }
    else showToast('Failed to save', 'error');
  };

  const test = async () => {
    setTesting(true); setConnStatus('idle');
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
            {connStatus === 'ok' ? 'Connection successful!' : 'Failed — check credentials.'}
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

// ─── Labels Tab ───────────────────────────────────────────────────────────────
function LabelsTab({ labels, onRefresh, showToast }: {
  labels: CutoffLabel[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setFormStart(''); setFormEnd(''); setFormUrl(''); };

  // Format display: "May 1–15, 2026"
  const formatRange = (start: string, end: string) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const sMonth = s.toLocaleString('default', { month: 'long' });
    const eMonth = e.toLocaleString('default', { month: 'long' });
    const year = s.getFullYear();
    if (sMonth === eMonth) {
      return `${sMonth} ${s.getDate()}–${e.getDate()}, ${year}`;
    }
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${year}`;
  };

  // Group by year then month
  const grouped = labels.reduce<Record<number, Record<number, CutoffLabel[]>>>((acc, l) => {
    const d = new Date(l.startDate + 'T00:00:00');
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-11
    if (!acc[year]) acc[year] = {};
    if (!acc[year][month]) acc[year][month] = [];
    acc[year][month].push(l);
    return acc;
  }, {});

  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const saveLabel = async (isEdit: boolean) => {
    if (!formStart || !formEnd || !formUrl.trim()) {
      showToast('All fields are required', 'error'); return;
    }
    if (new Date(formStart) > new Date(formEnd)) {
      showToast('Start date must be before end date', 'error'); return;
    }
    setSaving(true);
    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit
      ? { id: editId, startDate: formStart, endDate: formEnd, url: formUrl.trim() }
      : { startDate: formStart, endDate: formEnd, url: formUrl.trim() };
    const res = await fetch('/api/labels', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      showToast(isEdit ? 'Label updated' : 'Label added', 'success');
      setShowAdd(false); setEditId(null); resetForm(); await onRefresh();
    } else showToast('Failed to save', 'error');
  };

  const deleteLabel = async (id: string, label: CutoffLabel) => {
    if (!confirm(`Delete "${formatRange(label.startDate, label.endDate)}"?`)) return;
    await fetch(`/api/labels?id=${id}`, { method: 'DELETE' });
    showToast('Label deleted', 'info');
    await onRefresh();
  };

  return (
    <div className="fade-up">
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          Quick-access shortcuts to cutoff period tracking links, sorted by date.
        </p>
        <button className="btn btn-navy btn-sm" onClick={() => { resetForm(); setShowAdd(true); setEditId(null); }}>
          <Plus size={13} /> Add Label
        </button>
      </div>

      {/* Add / Edit form */}
      {(showAdd || editId) && (
        <div className="card slide-down" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--navy)' }}>
            {editId ? 'Edit Cutoff Label' : 'New Cutoff Label'}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={formStart}
                onChange={e => setFormStart(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label className="label">End Date</label>
              <input className="input" type="date" value={formEnd}
                onChange={e => setFormEnd(e.target.value)} />
            </div>
            <div style={{ flex: '2 1 260px' }}>
              <label className="label">URL</label>
              <input className="input" value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder="https://..." type="url" />
            </div>
          </div>

          {/* Preview */}
          {formStart && formEnd && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--blue)', fontWeight: 600 }}>
              Preview: {formatRange(formStart, formEnd)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => saveLabel(!!editId)} disabled={saving}>
              {saving ? <RefreshCw size={13} className="spin" /> : <Save size={13} />} Save
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setEditId(null); resetForm(); }}>
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {labels.length === 0 && !showAdd && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <Link size={36} style={{ color: 'var(--gray-300)', marginBottom: 12 }} />
          <div style={{ color: 'var(--gray-500)', fontSize: 14 }}>No cutoff labels yet.</div>
          <div style={{ color: 'var(--gray-400)', fontSize: 12, marginTop: 4 }}>
            Add labels to quickly access cutoff period tracking links.
          </div>
        </div>
      )}

      {/* Grouped by year → month */}
      {years.map(year => {
        const months = Object.keys(grouped[year]).map(Number).sort((a, b) => a - b);
        return (
          <div key={year} style={{ marginBottom: 32 }}>
            {/* Year header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>{year}</div>
              <div style={{ flex: 1, height: 2, background: 'var(--gray-200)', borderRadius: 99 }} />
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                {labels.filter(l => new Date(l.startDate).getFullYear() === year).length} periods
              </span>
            </div>

            {/* Months */}
            {months.map(month => (
              <div key={month} style={{ marginBottom: 16 }}>
                {/* Month header */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 2 }}>
                  {monthNames[month]}
                </div>

                {/* Labels for this month */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {grouped[year][month].map(label => (
                    <div key={label.id} style={{
                      display: 'flex', alignItems: 'center', gap: 0,
                      border: '1.5px solid var(--gray-200)', borderRadius: 8,
                      overflow: 'hidden', background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                      {/* Main link */}
                      <a href={label.url} target="_blank" rel="noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', textDecoration: 'none',
                        color: 'var(--navy)', fontWeight: 700, fontSize: 13,
                        borderRight: '1.5px solid var(--gray-200)',
                        transition: 'background 0.15s',
                      }}>
                        <ExternalLink size={12} color="var(--blue)" />
                        {formatRange(label.startDate, label.endDate)}
                      </a>
                      {/* Edit */}
                      <button onClick={() => {
                        setEditId(label.id);
                        setFormStart(label.startDate);
                        setFormEnd(label.endDate);
                        setFormUrl(label.url);
                        setShowAdd(false);
                      }} style={{ padding: '10px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex', borderRight: '1.5px solid var(--gray-200)' }}>
                        <Edit2 size={12} />
                      </button>
                      {/* Delete */}
                      <button onClick={() => deleteLabel(label.id, label)}
                        style={{ padding: '10px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}