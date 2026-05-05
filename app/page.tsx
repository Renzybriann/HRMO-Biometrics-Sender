'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2, Mail, Plus, Trash2, Send, Upload, FileText,
  RefreshCw, CheckCircle, XCircle, Clock, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, X, Edit2, Save, AlertCircle, Paperclip,
  Eye, EyeOff, Shield, Pencil, Info, Minimize2, Maximize2,
  Layers, StopCircle, RotateCcw
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Office { id: string; name: string; emails: string[]; createdAt: string; }
interface SendLog { id: string; officeId: string; officeName: string; email: string; sentAt: string; status: 'success' | 'failed'; filesCount: number; error?: string; }
interface PDFFile { name: string; size: number; uploadedAt: string; }
interface EmailTemplate { subject: string; body: string; }

type QueueStatus = 'idle' | 'running' | 'paused' | 'done';
interface QueueItem {
  officeId: string;
  officeName: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'retrying';
  error?: string;
  attempt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (bytes: number) => bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--blue)' };
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : Info;
  return (
    <div className="fade-up" style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      background: colors[type], color: '#fff',
      padding: '12px 18px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
      display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500, maxWidth: 380,
    }}>
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 2, display: 'flex' }}><X size={14} /></button>
    </div>
  );
}

// ─── Queue Progress Panel ─────────────────────────────────────────────────────
function QueuePanel({ queue, status, countdown, onStop, onClose }: {
  queue: QueueItem[]; status: QueueStatus; countdown: number;
  onStop: () => void; onClose: () => void;
}) {
  const done = queue.filter(q => q.status === 'sent' || q.status === 'failed').length;
  const total = queue.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const next = queue.find(q => q.status === 'pending');

  const statusColors: Record<string, string> = {
    pending: 'var(--gray-300)', sending: 'var(--blue)',
    retrying: 'var(--warning)', sent: 'var(--success)', failed: 'var(--danger)',
  };
  const statusLabels: Record<string, string> = {
    pending: 'Pending', sending: 'Sending...', retrying: 'Retrying',
    sent: 'Sent ✓', failed: 'Failed ✗',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9998,
      width: 360, background: '#fff', borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-lg)', border: '1px solid var(--gray-200)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ background: 'var(--navy)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {status === 'running' && <RefreshCw size={14} color="var(--yellow)" className="spin" />}
        {status === 'done' && <CheckCircle size={14} color="#6ee7b7" />}
        {status === 'paused' && <StopCircle size={14} color="#fca5a5" />}
        <span style={{ flex: 1, color: '#fff', fontWeight: 700, fontSize: 13 }}>
          {status === 'running' ? 'Sending Queue' : status === 'done' ? 'Queue Complete' : 'Queue Stopped'}
        </span>
        <span style={{ color: 'var(--yellow)', fontSize: 12, fontWeight: 700 }}>{done}/{total}</span>
        {(status === 'done' || status === 'paused') && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', marginLeft: 4 }}><X size={14} /></button>
        )}
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--gray-100)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue)', transition: 'width 0.4s ease' }} />
      </div>
      {/* Queue items */}
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 0' }}>
        {queue.map(item => (
          <div key={item.officeId} style={{ padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[item.status], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--navy)' }}>{item.officeName}</span>
            {(item.status === 'sending' || item.status === 'retrying') && <RefreshCw size={11} color="var(--blue)" className="spin" />}
            <span style={{ fontSize: 11, color: statusColors[item.status], fontWeight: 600 }}>{statusLabels[item.status]}</span>
          </div>
        ))}
      </div>
      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {status === 'running' && countdown > 0 && next && (
          <span style={{ flex: 1, fontSize: 11, color: 'var(--gray-500)' }}>
            Next: <strong>{next.officeName}</strong> in {countdown}s
          </span>
        )}
        {status === 'running' && (!next || countdown === 0) && <span style={{ flex: 1, fontSize: 11, color: 'var(--gray-500)' }}>Processing...</span>}
        {status === 'done' && (
          <span style={{ flex: 1, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
            ✓ {queue.filter(q => q.status === 'sent').length} sent · {queue.filter(q => q.status === 'failed').length} failed
          </span>
        )}
        {status === 'paused' && <span style={{ flex: 1, fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>Stopped by user</span>}
        {status === 'running' && (
          <button className="btn btn-danger btn-sm" onClick={onStop} style={{ fontSize: 11 }}>
            <StopCircle size={12} /> Stop
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
type Tab = 'offices' | 'template' | 'logs' | 'admin';
function Sidebar({ active, onChange, logCount }: { active: Tab; onChange: (t: Tab) => void; logCount: number }) {
  const items: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'offices', label: 'Offices', icon: <Building2 size={17} /> },
    { id: 'template', label: 'Email Template', icon: <Pencil size={17} /> },
    { id: 'logs', label: 'Send History', icon: <Clock size={17} />, badge: logCount },
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
      <div style={{ padding: '16px 20px', color: 'rgba(255,255,255,0.25)', fontSize: 10, letterSpacing: '0.06em' }}>
        AUTO-SEND: 15th of month · 8AM
      </div>
    </aside>
  );
}

// ─── EmailList (must be outside parent to prevent typing bug) ─────────────────
function EmailList({ emails, onChange }: { emails: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      {emails.map((email, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input className="input" value={email}
            onChange={e => { const n = [...emails]; n[i] = e.target.value; onChange(n); }}
            placeholder={`Gmail address${emails.length > 1 ? ` ${i + 1}` : ''}`} type="email" />
          {emails.length > 1 && (
            <button className="btn btn-danger btn-icon" onClick={() => onChange(emails.filter((_, j) => j !== i))}><X size={13} /></button>
          )}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', gap: 4 }} onClick={() => onChange([...emails, ''])}>
        <Plus size={12} /> Add email
      </button>
    </div>
  );
}

// ─── DragDropPanel ────────────────────────────────────────────────────────────
function DragDropPanel({ officeId, files, uploading, onUpload, onDelete, onClickUpload }: {
  officeId: string; files: PDFFile[]; uploading: boolean;
  onUpload: (id: string, files: FileList) => void;
  onDelete: (id: string, name: string) => void;
  onClickUpload: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="slide-down" style={{ borderTop: '1px solid var(--gray-200)', background: 'var(--gray-50)', padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Files</span>
        <button className="btn btn-navy btn-sm" style={{ fontSize: 11 }} disabled={uploading} onClick={onClickUpload}>
          <Upload size={11} /> {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      <div
        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length > 0) onUpload(officeId, e.dataTransfer.files); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={onClickUpload}
        style={{
          border: `2px dashed ${dragging ? 'var(--blue)' : 'var(--gray-200)'}`,
          borderRadius: 6, padding: files.length === 0 ? '20px 8px' : '8px',
          textAlign: 'center', background: dragging ? 'var(--blue-pale)' : 'transparent',
          cursor: 'pointer', transition: 'all 0.15s', marginBottom: files.length > 0 ? 8 : 0,
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--blue)', fontSize: 11 }}><RefreshCw size={13} className="spin" /> Uploading...</div>
        ) : dragging ? (
          <div style={{ color: 'var(--blue)', fontSize: 11, fontWeight: 600 }}><Upload size={16} style={{ marginBottom: 4 }} /><div>Drop to upload</div></div>
        ) : files.length === 0 ? (
          <div style={{ color: 'var(--gray-500)', fontSize: 11 }}><Upload size={16} style={{ marginBottom: 4, opacity: 0.4 }} /><div>Drag & drop PDFs here</div><div style={{ fontSize: 10, marginTop: 2, color: 'var(--gray-300)' }}>or click to browse</div></div>
        ) : (
          <div style={{ color: 'var(--gray-300)', fontSize: 10 }}>Drop more PDFs or click to browse</div>
        )}
      </div>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {files.map(file => (
            <div key={file.name} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={13} color="var(--danger)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <span style={{ fontSize: 10, color: 'var(--gray-300)', flexShrink: 0 }}>{fmt(file.size)}</span>
              <button className="btn btn-danger btn-icon btn-sm" style={{ padding: 4 }} onClick={() => onDelete(officeId, file.name)}><X size={11} /></button>
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
  const [template, setTemplate] = useState<EmailTemplate>({ subject: '', body: '' });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [countdown, setCountdown] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const stopRef = useRef(false);
  const DELAY_S = 30;

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ msg, type }), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [offRes, setRes] = await Promise.all([fetch('/api/offices'), fetch('/api/settings')]);
      const [offData, setData] = await Promise.all([offRes.json(), setRes.json()]);
      setOffices(offData);
      setLogs(setData.logs || []);
      setAutoSend(setData.autoSendEnabled);
      setTemplate(setData.emailTemplate || { subject: '', body: '' });
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runCountdown = async (seconds: number, nextName: string) => {
    for (let i = seconds; i > 0; i--) {
      if (stopRef.current) break;
      setCountdown(i);
      await sleep(1000);
    }
    setCountdown(0);
  };

  // Queue-based send all with 30s delay + retry
  const handleSendAll = async () => {
    if (offices.length === 0) return;
    stopRef.current = false;
    const initial: QueueItem[] = offices.map(o => ({ officeId: o.id, officeName: o.name, status: 'pending', attempt: 0 }));
    setQueue(initial);
    setQueueStatus('running');
    setShowQueue(true);

    let q = [...initial];

    for (let i = 0; i < q.length; i++) {
      if (stopRef.current) { setQueueStatus('paused'); break; }

      q[i] = { ...q[i], status: 'sending', attempt: 1 };
      setQueue([...q]);

      let success = false;
      let lastError = '';

      for (let attempt = 1; attempt <= 2; attempt++) {
        if (stopRef.current) break;
        try {
          const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officeId: q[i].officeId }) });
          const data = await res.json();
          if (data.failed > 0) throw new Error(data.results?.[0]?.error || 'Send failed');
          success = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Unknown error';
          if (attempt < 2 && !stopRef.current) {
            q[i] = { ...q[i], status: 'retrying', attempt: 2 };
            setQueue([...q]);
            await sleep(5000);
          }
        }
      }

      q[i] = { ...q[i], status: success ? 'sent' : 'failed', error: success ? undefined : lastError };
      setQueue([...q]);

      // 30s delay between offices, skip after last
      if (!stopRef.current && i < q.length - 1) {
        const nextName = q[i + 1]?.officeName ?? '';
        await runCountdown(DELAY_S, nextName);
      }
    }

    if (!stopRef.current) setQueueStatus('done');
    await fetchAll();
  };

  // Single office send (no queue)
  const handleSendOne = async (officeId: string) => {
    setSendingId(officeId);
    try {
      const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officeId }) });
      const data = await res.json();
      await fetchAll();
      if (data.failed > 0) showToast(`Failed: ${data.results?.[0]?.error || 'Unknown error'}`, 'error');
      else showToast('Email sent successfully!', 'success');
    } catch { showToast('Send failed. Check Admin credentials.', 'error'); }
    finally { setSendingId(null); }
  };

  const handleToggleAutoSend = async () => {
    const newVal = !autoSend;
    setAutoSend(newVal);
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoSendEnabled: newVal }) });
    showToast(`Auto-send ${newVal ? 'enabled' : 'disabled'}`, 'info');
  };

  const isQueueRunning = queueStatus === 'running';
  const sentCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const queueMap = Object.fromEntries(queue.map(q => [q.officeId, q]));

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showQueue && <QueuePanel queue={queue} status={queueStatus} countdown={countdown} onStop={() => { stopRef.current = true; }} onClose={() => { setShowQueue(false); setQueue([]); setQueueStatus('idle'); }} />}
      <Sidebar active={tab} onChange={setTab} logCount={logs.length} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{ background: '#fff', borderBottom: '1px solid var(--gray-200)', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--navy)' }}>
            {tab === 'offices' ? 'Office Management' : tab === 'template' ? 'Email Template' : tab === 'logs' ? 'Send History' : 'Admin Configuration'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleToggleAutoSend} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
              borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gray-200)',
              background: autoSend ? 'var(--blue-pale)' : 'var(--gray-100)',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              color: autoSend ? 'var(--blue)' : 'var(--gray-500)', transition: 'all 0.15s',
            }}>
              {autoSend ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              Auto-send {autoSend ? 'ON' : 'OFF'}
            </button>
            {isQueueRunning ? (
              <button className="btn btn-danger" onClick={() => { stopRef.current = true; }}>
                <StopCircle size={14} /> Stop Queue
              </button>
            ) : (
              <button className="btn btn-yellow" onClick={handleSendAll} disabled={offices.length === 0}>
                <Send size={14} /> Send All Now
              </button>
            )}
          </div>
        </header>

        {/* Stats strip */}
        {tab === 'offices' && (
          <div style={{ background: 'var(--navy-800)', padding: '14px 32px', display: 'flex', gap: 32, alignItems: 'center' }}>
            {[
              { label: 'Total Offices', value: offices.length, color: '#fff' },
              { label: 'Emails Sent', value: sentCount, color: 'var(--success)' },
              { label: 'Failed Sends', value: failedCount, color: '#fc8181' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</span>
              </div>
            ))}
            {isQueueRunning && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={13} color="var(--yellow)" className="spin" />
                <span style={{ color: 'var(--yellow)', fontSize: 12, fontWeight: 700 }}>
                  Queue: {queue.filter(q => q.status === 'sent' || q.status === 'failed').length}/{queue.length}
                </span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setShowQueue(true)}>View</button>
              </div>
            )}
          </div>
        )}

        <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--gray-500)', gap: 10 }}>
              <RefreshCw size={18} className="spin" /> Loading...
            </div>
          ) : (
            <>
              {tab === 'offices'  && <OfficesTab offices={offices} sendingId={sendingId} queueMap={queueMap} onSendOne={handleSendOne} onRefresh={fetchAll} showToast={showToast} />}
              {tab === 'template' && <TemplateTab template={template} setTemplate={setTemplate} showToast={showToast} />}
              {tab === 'logs'     && <LogsTab logs={logs} />}
              {tab === 'admin'    && <AdminTab showToast={showToast} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Offices Tab ──────────────────────────────────────────────────────────────
function OfficesTab({ offices, sendingId, queueMap, onSendOne, onRefresh, showToast }: {
  offices: Office[]; sendingId: string | null; queueMap: Record<string, QueueItem>;
  onSendOne: (id: string) => void; onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmails, setFormEmails] = useState<string[]>(['']);
  const [formError, setFormError] = useState('');
  const [pdfMap, setPdfMap] = useState<Record<string, PDFFile[]>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeUploadId = useRef<string>('');

  // Bulk control state
  const [showAllAttachments, setShowAllAttachments] = useState(false);
  const [openPdfs, setOpenPdfs] = useState<Set<string>>(new Set());
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const allCollapsed = offices.length > 0 && collapsedCards.size === offices.length;

  const fetchPDFs = async (id: string) => {
    const res = await fetch(`/api/upload?officeId=${id}`);
    const data = await res.json();
    setPdfMap(p => ({ ...p, [id]: data.files || [] }));
  };

  // Show/hide all attachments
  useEffect(() => {
    if (showAllAttachments) {
      offices.forEach(o => { if (!pdfMap[o.id]) fetchPDFs(o.id); });
      setOpenPdfs(new Set(offices.map(o => o.id)));
    } else {
      setOpenPdfs(new Set());
    }
  }, [showAllAttachments]);

  const togglePdf = async (id: string) => {
    const next = new Set(openPdfs);
    if (next.has(id)) { next.delete(id); } else { next.add(id); if (!pdfMap[id]) await fetchPDFs(id); }
    setOpenPdfs(next);
    // If manually toggling, unsync from global toggle
    setShowAllAttachments(false);
  };

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsedCards);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCollapsedCards(next);
  };

  const toggleCollapseAll = () => {
    if (allCollapsed) setCollapsedCards(new Set());
    else setCollapsedCards(new Set(offices.map(o => o.id)));
  };

  const resetForm = () => { setFormName(''); setFormEmails(['']); setFormError(''); };

  const saveOffice = async (isEdit: boolean, officeId?: string) => {
    setFormError('');
    const cleanEmails = formEmails.map(e => e.trim()).filter(Boolean);
    if (!formName.trim() || cleanEmails.length === 0) { setFormError('Name and at least one email required.'); return; }
    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit ? { id: officeId, name: formName.trim(), emails: cleanEmails } : { name: formName.trim(), emails: cleanEmails };
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
    setUploading(true);
    const fd = new FormData();
    fd.append('officeId', officeId);
    for (const f of Array.from(files)) fd.append('files', f);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    await fetchPDFs(officeId);
    setUploading(false);
    showToast(`${data.count} file(s) uploaded`, 'success');
  };

  const deletePDF = async (officeId: string, fileName: string) => {
    await fetch(`/api/upload?officeId=${officeId}&file=${encodeURIComponent(fileName)}`, { method: 'DELETE' });
    await fetchPDFs(officeId);
    showToast('File removed', 'info');
  };

  const queueStatusColors: Record<string, string> = {
    pending: 'var(--gray-300)', sending: 'var(--blue)',
    retrying: 'var(--warning)', sent: 'var(--success)', failed: 'var(--danger)',
  };

  return (
    <div className="fade-up">
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={toggleCollapseAll}>
          {allCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          {allCollapsed ? 'Expand All' : 'Collapse All'}
        </button>
        <button className="btn btn-sm" onClick={() => setShowAllAttachments(!showAllAttachments)}
          style={{ background: showAllAttachments ? 'var(--blue-pale)' : 'var(--gray-100)', color: showAllAttachments ? 'var(--blue)' : 'var(--gray-700)' }}>
          <Layers size={13} />
          {showAllAttachments ? 'Hide All Attachments' : 'Show All Attachments'}
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-navy btn-sm" onClick={() => { resetForm(); setShowAdd(true); setEditId(null); }}>
            <Plus size={13} /> Add Office
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card slide-down" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--navy)' }}>New Office</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="label">Office Name</label>
              <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Human Resource Office" />
            </div>
            <div style={{ flex: '2 1 280px' }}>
              <label className="label">Email Address(es)</label>
              <EmailList emails={formEmails} onChange={setFormEmails} />
            </div>
          </div>
          {formError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => saveOffice(false)}><Save size={13} /> Save Office</button>
            <button className="btn btn-ghost" onClick={() => { setShowAdd(false); resetForm(); }}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {offices.length === 0 && !showAdd && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <Building2 size={40} style={{ color: 'var(--gray-300)', marginBottom: 12 }} />
          <div style={{ color: 'var(--gray-500)', fontSize: 14 }}>No offices yet. Add your first office to get started.</div>
        </div>
      )}

      {/* Office grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {offices.map((office, i) => {
          const isCollapsed = collapsedCards.has(office.id);
          const isPdfOpen = openPdfs.has(office.id);
          const qItem = queueMap[office.id];
          const isSendingThis = sendingId === office.id || qItem?.status === 'sending' || qItem?.status === 'retrying';

          return (
            <div key={office.id} className={`card fade-up d${Math.min(i + 1, 5)}`} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {editId === office.id ? (
                /* Edit mode */
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  <div><label className="label">Office Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} /></div>
                  <div><label className="label">Email(s)</label><EmailList emails={formEmails} onChange={setFormEmails} /></div>
                  {formError && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{formError}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => saveOffice(true, office.id)}><Save size={13} /> Save</button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditId(null); resetForm(); }}><X size={13} /></button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Card header */}
                  <div style={{ background: 'linear-gradient(135deg, var(--navy-700), var(--navy))', padding: '14px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={16} color="var(--yellow)" />
                      </div>
                      {/* Queue status dot */}
                      {qItem && <div title={qItem.status} style={{ width: 8, height: 8, borderRadius: '50%', background: queueStatusColors[qItem.status], boxShadow: qItem.status === 'sending' ? '0 0 0 3px rgba(29,111,206,0.4)' : 'none', flexShrink: 0 }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="btn btn-icon btn-sm" title={isCollapsed ? 'Expand' : 'Collapse'}
                        style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderRadius: 6 }}
                        onClick={() => toggleCollapse(office.id)}>
                        {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                      </button>
                      <button className="btn btn-icon btn-sm" title="Edit"
                        style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6 }}
                        onClick={() => { setEditId(office.id); setFormName(office.name); setFormEmails([...(office.emails ?? [''])]); setFormError(''); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-icon btn-sm" title="Delete"
                        style={{ background: 'rgba(220,38,38,0.25)', color: '#fca5a5', borderRadius: 6 }}
                        onClick={() => deleteOffice(office.id, office.name)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Collapsed view */}
                  {isCollapsed ? (
                    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 8 }}
                      onClick={() => toggleCollapse(office.id)}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{office.name}</span>
                      {qItem && <span style={{ fontSize: 10, fontWeight: 700, color: queueStatusColors[qItem.status], flexShrink: 0 }}>{qItem.status}</span>}
                    </div>
                  ) : (
                    /* Expanded body */
                    <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', lineHeight: 1.3 }}>{office.name}</div>

                      {/* Queue status banner */}
                      {qItem && qItem.status !== 'pending' && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: queueStatusColors[qItem.status], background: `${queueStatusColors[qItem.status]}18`, padding: '4px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {qItem.status === 'sending' && <><RefreshCw size={10} className="spin" />Sending...</>}
                          {qItem.status === 'retrying' && <><RotateCcw size={10} />Retrying (attempt {qItem.attempt})...</>}
                          {qItem.status === 'sent' && <><CheckCircle size={10} />Sent successfully</>}
                          {qItem.status === 'failed' && <><XCircle size={10} />Failed: {qItem.error}</>}
                        </div>
                      )}

                      {/* Emails */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {(office.emails ?? []).map((email, ei) => (
                          <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--gray-500)', overflow: 'hidden' }}>
                            <Mail size={10} color="var(--blue)" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                          </div>
                        ))}
                      </div>

                      {/* Attachments toggle */}
                      <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', gap: 6, fontSize: 11 }}
                        onClick={() => togglePdf(office.id)}>
                        <Paperclip size={11} />
                        {pdfMap[office.id]?.length ?? '–'} attachment{(pdfMap[office.id]?.length ?? 0) !== 1 ? 's' : ''}
                        {isPdfOpen ? <ChevronUp size={11} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={11} style={{ marginLeft: 'auto' }} />}
                      </button>

                      {/* Send button */}
                      <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 'auto' }}
                        disabled={isSendingThis || !!qItem}
                        onClick={() => onSendOne(office.id)}
                        title={qItem ? 'In queue — use Send All' : 'Send now'}>
                        {isSendingThis ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
                        {qItem
                          ? qItem.status === 'sent' ? 'Sent ✓'
                          : qItem.status === 'failed' ? 'Failed ✗'
                          : qItem.status === 'pending' ? 'In Queue'
                          : 'Sending...'
                          : 'Send Report'}
                      </button>
                    </div>
                  )}

                  {/* PDF panel */}
                  {!isCollapsed && isPdfOpen && (
                    <DragDropPanel
                      officeId={office.id}
                      files={pdfMap[office.id] ?? []}
                      uploading={uploading}
                      onUpload={uploadPDFs}
                      onDelete={deletePDF}
                      onClickUpload={() => { activeUploadId.current = office.id; fileRef.current?.click(); }}
                    />
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

// ─── Template Tab ─────────────────────────────────────────────────────────────
function TemplateTab({ template, setTemplate, showToast }: {
  template: EmailTemplate; setTemplate: (t: EmailTemplate) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [localSubject, setLocalSubject] = useState(template.subject);
  const [localBody, setLocalBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocalSubject(template.subject); setLocalBody(template.body); }, [template]);

  const save = async () => {
    setSaving(true);
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailTemplate: { subject: localSubject, body: localBody } }) });
    setTemplate({ subject: localSubject, body: localBody });
    setSaving(false);
    showToast('Template saved', 'success');
  };

  const previewText = (text: string) =>
    text.replace(/\{\{officeName\}\}/g, 'Human Resource Office')
        .replace(/\{\{month\}\}/g, new Date().toLocaleString('default', { month: 'long', year: 'numeric' }))
        .replace(/\{\{senderName\}\}/g, 'Biometrics Department');

  const wrapSelection = (before: string, after: string) => {
    const ta = textareaRef.current; if (!ta) return;
    const start = ta.selectionStart; const end = ta.selectionEnd;
    setLocalBody(localBody.substring(0, start) + before + localBody.substring(start, end) + after + localBody.substring(end));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + before.length, end + before.length); }, 0);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current; if (!ta) return;
    const start = ta.selectionStart;
    setLocalBody(localBody.substring(0, start) + text + localBody.substring(start));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + text.length, start + text.length); }, 0);
  };

  const renderPreview = (text: string) =>
    text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>')
        .split('\n')
        .map(line => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 6px;color:#1e293b;line-height:1.7;font-size:14px;">${line}</p>`)
        .join('');

  const placeholders = [
    { key: '{{officeName}}', desc: 'Office name' },
    { key: '{{month}}', desc: 'Month & year' },
    { key: '{{senderName}}', desc: 'Sender name' },
  ];
  const toolbarBtns = [
    { label: 'B', title: 'Bold', style: { fontWeight: 800 as const }, action: () => wrapSelection('**', '**') },
    { label: 'I', title: 'Italic', style: { fontStyle: 'italic' as const }, action: () => wrapSelection('*', '*') },
    { label: '—', title: 'Divider', style: {}, action: () => insertAtCursor('\n---\n') },
  ];

  return (
    <div className="fade-up" style={{ maxWidth: 780 }}>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>Email Template</h2>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>Customize the email sent to all offices.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreview(!preview)}>
              {preview ? <EyeOff size={13} /> : <Eye size={13} />} {preview ? 'Edit' : 'Preview'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? <RefreshCw size={13} className="spin" /> : <Save size={13} />} Save
            </button>
          </div>
        </div>
        <div style={{ background: 'var(--blue-pale)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Placeholders:</span>
          {placeholders.map(p => (
            <button key={p.key} title={p.desc} onClick={() => insertAtCursor(p.key)}
              style={{ background: '#fff', color: 'var(--blue)', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, border: '1px solid var(--blue-pale)', cursor: 'pointer', fontFamily: 'monospace' }}>
              {p.key}
            </button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--gray-500)', marginLeft: 4 }}>Click to insert at cursor</span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="label">Subject Line</label>
          {preview ? (
            <div style={{ padding: '10px 14px', background: 'var(--gray-50)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600 }}>{previewText(localSubject)}</div>
          ) : (
            <input className="input" value={localSubject} onChange={e => setLocalSubject(e.target.value)} placeholder="Email subject..." />
          )}
        </div>
        <div>
          <label className="label">Email Body</label>
          {!preview && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 6, padding: '6px 8px', background: 'var(--gray-100)', borderRadius: '6px 6px 0 0', border: '1.5px solid var(--gray-200)', borderBottom: 'none' }}>
              {toolbarBtns.map(btn => (
                <button key={btn.label} title={btn.title} onClick={btn.action}
                  style={{ ...btn.style, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 4, width: 28, height: 26, cursor: 'pointer', fontSize: 13, color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                  {btn.label}
                </button>
              ))}
              <span style={{ fontSize: 10, color: 'var(--gray-300)', alignSelf: 'center', marginLeft: 6 }}>**bold** · *italic* · --- divider</span>
            </div>
          )}
          {preview ? (
            <div style={{ padding: 16, background: 'var(--gray-50)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.8, minHeight: 200 }}
              dangerouslySetInnerHTML={{ __html: renderPreview(previewText(localBody)) }} />
          ) : (
            <textarea ref={textareaRef} className="textarea" value={localBody} onChange={e => setLocalBody(e.target.value)} style={{ minHeight: 280, borderRadius: '0 0 6px 6px' }} />
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--gray-300)' }}>Select text then click B or I to format. Use Preview to see how it looks.</div>
      </div>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab({ logs }: { logs: SendLog[] }) {
  return (
    <div className="fade-up">
      {logs.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <Clock size={36} style={{ color: 'var(--gray-300)', marginBottom: 12 }} />
          <div style={{ color: 'var(--gray-500)' }}>No send history yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map((log, i) => (
            <div key={log.id} className={`card fade-up d${Math.min(i + 1, 5)}`} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: log.status === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {log.status === 'success' ? <CheckCircle size={17} color="var(--success)" /> : <XCircle size={17} color="var(--danger)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{log.officeName}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{log.email}</div>
                {log.error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3, fontWeight: 500 }}>⚠ {log.error}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{log.status === 'success' ? 'Sent' : 'Failed'}</span>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 5 }}>{log.filesCount} file{log.filesCount !== 1 ? 's' : ''} · {fmtDate(log.sentAt)}</div>
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
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    fetch('/api/admin').then(r => r.json()).then(d => { setGmailUser(d.gmailUser || ''); setSenderName(d.gmailFromName || ''); setHasPassword(d.hasPassword || false); });
  }, []);

  const save = async () => {
    if (!gmailUser) { showToast('Gmail address is required', 'error'); return; }
    setSaving(true);
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gmailUser, gmailAppPassword: gmailPass || undefined, gmailFromName: senderName }) });
    setSaving(false);
    if (res.ok) { showToast('Saved. Restart app to apply new credentials.', 'success'); setGmailPass(''); setHasPassword(true); }
    else showToast('Failed to save', 'error');
  };

  const testConnection = async () => {
    setTesting(true); setConnectionStatus('idle');
    const res = await fetch('/api/admin/verify');
    const data = await res.json();
    setConnectionStatus(data.connected ? 'ok' : 'fail');
    setTesting(false);
    showToast(data.connected ? 'Gmail connected!' : 'Connection failed.', data.connected ? 'success' : 'error');
  };

  return (
    <div className="fade-up" style={{ maxWidth: 600 }}>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={18} color="var(--yellow)" />
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>Gmail Configuration</h2>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Stored in <code style={{ fontSize: 11 }}>.env.local</code></p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label className="label">Sender Display Name</label><input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. Biometrics Department" /></div>
          <div><label className="label">Gmail Address</label><input className="input" value={gmailUser} onChange={e => setGmailUser(e.target.value)} placeholder="your_email@gmail.com" type="email" /></div>
          <div>
            <label className="label">Gmail App Password {hasPassword && <span className="badge badge-success" style={{ marginLeft: 8 }}>Saved</span>}</label>
            <div style={{ position: 'relative' }}>
              <input className="input" value={gmailPass} onChange={e => setGmailPass(e.target.value)}
                placeholder={hasPassword ? 'Enter new password to update' : 'xxxx-xxxx-xxxx-xxxx'}
                type={showPass ? 'text' : 'password'} style={{ paddingRight: 44 }} />
              <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex' }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 5 }}>
              Generate at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>myaccount.google.com/apppasswords</a> (requires 2FA)
            </div>
          </div>
        </div>
        {connectionStatus !== 'idle' && (
          <div className={`slide-down badge ${connectionStatus === 'ok' ? 'badge-success' : 'badge-danger'}`}
            style={{ marginTop: 16, padding: '8px 12px', borderRadius: 8, width: '100%', justifyContent: 'flex-start', gap: 8 }}>
            {connectionStatus === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {connectionStatus === 'ok' ? 'Gmail connection successful!' : 'Connection failed — check your credentials.'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} Save Configuration</button>
          <button className="btn btn-ghost" onClick={testConnection} disabled={testing}>{testing ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={14} />} Test Connection</button>
        </div>
      </div>
    </div>
  );
}