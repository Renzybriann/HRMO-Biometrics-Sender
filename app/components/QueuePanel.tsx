'use client';

import { CheckCircle, RefreshCw, StopCircle, X } from 'lucide-react';
import type { QueueItem, QueueStatus } from '@/lib/types';

const fmtDuration = (seconds: number) => {
  const safe = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export function QueuePanel({ queue, status, countdown, sent, total, intervalSeconds, onAbort, onClose }: {
  queue: QueueItem[];
  status: QueueStatus;
  countdown: number;
  sent: number;
  total: number;
  intervalSeconds: number;
  onAbort: () => void;
  onClose: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((sent / total) * 100);
  const next = queue.find(q => q.status === 'pending');
  const unfinished = queue.filter(q => q.status === 'pending' || q.status === 'sending' || q.status === 'retrying').length;
  const etaSeconds = status === 'running' ? countdown + Math.max(0, unfinished - 1) * intervalSeconds : 0;
  const qColors: Record<string, string> = { pending: 'var(--gray-300)', sending: 'var(--blue)', retrying: 'var(--warning)', sent: 'var(--success)', failed: 'var(--danger)' };
  const qLabels: Record<string, string> = { pending: 'Pending', sending: 'Sending...', retrying: 'Retrying', sent: 'Sent', failed: 'Failed' };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9998, width: 380, background: '#fff', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
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

      <div style={{ background: 'var(--gray-100)', height: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: status === 'aborted' ? 'var(--danger)' : 'var(--blue)', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ padding: '4px 16px 0', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-500)' }}>
        <span>{pct}% complete</span><span>{sent} of {total} sent</span>
      </div>

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

      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {status === 'running' && countdown > 0 && next && <span style={{ flex: 1, fontSize: 11, color: 'var(--gray-500)' }}>Next: <strong>{next.officeName}</strong> in {countdown}s · ETA ~{fmtDuration(etaSeconds)}</span>}
        {status === 'running' && (!next || countdown === 0) && <span style={{ flex: 1, fontSize: 11, color: 'var(--gray-500)' }}>Processing... · ETA ~{fmtDuration(etaSeconds)}</span>}
        {status === 'done' && <span style={{ flex: 1, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{queue.filter(q => q.status === 'sent').length} sent · {queue.filter(q => q.status === 'failed').length} failed</span>}
        {status === 'aborted' && <span style={{ flex: 1, fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>Aborted - {queue.filter(q => q.status === 'sent').length} already sent</span>}
        {status === 'running' && <button className="btn btn-danger btn-sm" onClick={onAbort}><StopCircle size={12} /> Abort</button>}
      </div>
    </div>
  );
}
