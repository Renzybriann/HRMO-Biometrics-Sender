'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, CheckCircle, XCircle, ToggleLeft, ToggleRight,
  X, Info, StopCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import type { CutoffLabel, EmailTemplate, Office, QueueItem, QueueStatus, SchedulerConfig, SendLog } from '@/lib/types';
import { AdminTab } from './components/AdminTab';
import { LabelsTab } from './components/LabelsTab';
import { LogsTab } from './components/LogsTab';
import { OfficesTab } from './components/OfficesTab';
import { QueuePanel } from './components/QueuePanel';
import { SchedulerTab } from './components/SchedulerTab';
import { Sidebar } from './components/Sidebar';
import { TemplatesTab } from './components/TemplatesTab';

// ─── Types ───────────────────────────────────────────────────────────────────


// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const DEFAULT_SCHEDULER: SchedulerConfig = { enabled: true, dayOfMonth: 15, hour: 8, minute: 0, sendIntervalSeconds: 30 };

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
type Tab = 'offices' | 'templates' | 'scheduler' | 'logs' | 'labels' | 'admin';


// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('offices');
  const [offices, setOffices] = useState<Office[]>([]);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [autoSend, setAutoSend] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState('default');
  const [scheduler, setScheduler] = useState<SchedulerConfig>(DEFAULT_SCHEDULER);
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
  const sendIntervalSeconds = scheduler.sendIntervalSeconds ?? DEFAULT_SCHEDULER.sendIntervalSeconds;

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
      setScheduler({ ...DEFAULT_SCHEDULER, ...(setData.scheduler || {}) });
      setScheduledOfficeIds(setData.scheduledOfficeIds || []);
      setLabels(Array.isArray(labData) ? labData : []);
    } catch { showToast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

// ── Auto logout after 10 minutes of inactivity ──────────────────────────────
useEffect(() => {
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  let timer: ReturnType<typeof setTimeout>;
  const isSending = queueStatus === 'running' || sendingId !== null;

  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (isSending) {
        resetTimer();
        return;
      }

      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/login';
    }, TIMEOUT_MS);
  };

  // Events that count as activity
  const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  events.forEach(e => window.addEventListener(e, resetTimer));

  // Start the timer on mount
  resetTimer();

  return () => {
    clearTimeout(timer);
    events.forEach(e => window.removeEventListener(e, resetTimer));
  };
}, [queueStatus, sendingId]);

  

  const runCountdown = async (seconds: number) => {
    for (let i = seconds; i > 0; i--) {
      if (abortRef.current) break;
      setCountdown(i);
      await sleep(1000);
    }
    setCountdown(0);
  };

  // Queue-based bulk send with selection support
  const handleSendSelected = async (selectedIds: string[], templateId?: string) => {
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
          const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officeId: q[i].officeId, templateId }) });
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

      if (!abortRef.current && i < q.length - 1) await runCountdown(sendIntervalSeconds);
    }

    if (!abortRef.current) setQueueStatus('done');
    await fetchAll();
  };

  

  const handleSendOne = async (officeId: string, templateId?: string) => {
    setSendingId(officeId);
    try {
      const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officeId, templateId }) });
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
  const tabTitles: Record<Tab, string> = { offices: 'Office Management', templates: 'Email Templates', scheduler: 'Scheduler', logs: 'Send History', labels: 'Cutoff Labels', admin: 'Admin' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showQueue && <QueuePanel queue={queue} status={queueStatus} countdown={countdown} sent={queueSent} total={queue.length} intervalSeconds={sendIntervalSeconds} onAbort={() => { abortRef.current = true; }} onClose={() => { setShowQueue(false); setQueue([]); setQueueStatus('idle'); setQueueSent(0); }} />}
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
              {tab === 'logs' && <LogsTab logs={logs} offices={offices} />}
              {tab === 'labels' && <LabelsTab labels={labels} onRefresh={fetchAll} showToast={showToast} />}
              {tab === 'admin' && <AdminTab showToast={showToast} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

