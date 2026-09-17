'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, FileText, RefreshCw, XCircle } from 'lucide-react';
import type { Office, SendLog } from '@/lib/types';

type LogPeriod = 'recent' | 'current' | 'previous' | 'custom';

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function dateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function cutoffRange(period: Exclude<LogPeriod, 'recent' | 'custom'>) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (period === 'current') {
    const start = day <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);
    const end = day <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
    return { from: dateInput(start), to: dateInput(end) };
  }

  const start = day <= 15 ? new Date(year, month - 1, 16) : new Date(year, month, 1);
  const end = day <= 15 ? new Date(year, month, 0) : new Date(year, month, 15);
  return { from: dateInput(start), to: dateInput(end) };
}

function csvCell(value: string | number | undefined) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function LogsTab({ logs, offices }: { logs: SendLog[]; offices: Office[] }) {
  const PAGE_SIZE = 25;
  const [rows, setRows] = useState<SendLog[]>(logs);
  const [total, setTotal] = useState(logs.length);
  const [period, setPeriod] = useState<LogPeriod>('recent');
  const [status, setStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [officeId, setOfficeId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setRows(logs.slice(0, PAGE_SIZE)); setTotal(logs.length); }, [logs]);

  useEffect(() => { setPage(1); }, [period, status, officeId, from, to]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
      if (status !== 'all') params.set('status', status);
      if (officeId !== 'all') params.set('officeId', officeId);

      if (period === 'custom') {
        if (!from || !to) return;
        params.set('from', from);
        params.set('to', to);
      } else if (period !== 'recent') {
        const range = cutoffRange(period);
        params.set('from', range.from);
        params.set('to', range.to);
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/logs?${params.toString()}`);
        const data = await res.json();
        if (!cancelled) {
          setRows(Array.isArray(data.logs) ? data.logs : []);
          setTotal(Number(data.total) || 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [period, status, officeId, from, to, page]);

  const shownRange = period === 'custom'
    ? from && to ? `${from} to ${to}` : 'Select a date range'
    : period === 'recent'
      ? 'Latest 500 records'
      : (() => {
          const range = cutoffRange(period);
          return `${range.from} to ${range.to}`;
        })();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstResult = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastResult = Math.min(page * PAGE_SIZE, total);

  const exportCsv = async () => {
    const params = new URLSearchParams({ limit: '1000' });
    if (status !== 'all') params.set('status', status);
    if (officeId !== 'all') params.set('officeId', officeId);
    if (period === 'custom') {
      if (!from || !to) return;
      params.set('from', from);
      params.set('to', to);
    } else if (period !== 'recent') {
      const range = cutoffRange(period);
      params.set('from', range.from);
      params.set('to', range.to);
    }

    setExporting(true);
    try {
      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();
      const exportRows: SendLog[] = Array.isArray(data.logs) ? data.logs : [];
      const header = ['Office', 'Email', 'Status', 'Files', 'Sent At', 'Error'];
      const lines = [
        header.map(csvCell).join(','),
        ...exportRows.map(log => [
          log.officeName,
          log.email,
          log.status,
          log.filesCount,
          fmtDate(log.sentAt),
          log.error ?? '',
        ].map(csvCell).join(',')),
      ];
      const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `send-history-${dateInput(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fade-up">
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <label className="label">Period</label>
            <select className="input" value={period} onChange={e => setPeriod(e.target.value as LogPeriod)}>
              <option value="recent">Recent</option>
              <option value="current">Current cutoff</option>
              <option value="previous">Previous cutoff</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          <div>
            <label className="label">Office</label>
            <select className="input" value={officeId} onChange={e => setOfficeId(e.target.value)}>
              <option value="all">All offices</option>
              {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value as 'all' | 'success' | 'failed')}>
              <option value="all">All statuses</option>
              <option value="success">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 3 }}>{total} result{total !== 1 ? 's' : ''}</div>
            <div>{shownRange}</div>
          </div>
          <button className="btn btn-navy" onClick={exportCsv} disabled={exporting || total === 0 || (period === 'custom' && (!from || !to))}>
            {exporting ? <RefreshCw size={13} className="spin" /> : <FileText size={13} />} Export CSV
          </button>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: 10, marginTop: 12 }}>
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 36, textAlign: 'center', color: 'var(--gray-500)' }}><RefreshCw size={18} className="spin" style={{ marginBottom: 8 }} />Loading send history...</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}><Clock size={36} style={{ color: 'var(--gray-300)', marginBottom: 12 }} /><div style={{ color: 'var(--gray-500)' }}>No send history yet.</div></div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12, color: 'var(--gray-500)' }}>
            <span>Showing {firstResult}-{lastResult} of {total}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
              <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Page {page} of {pageCount}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Next</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((log, i) => (
              <div key={log.id} className={`card fade-up d${Math.min(i + 1, 5)}`} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: log.status === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {log.status === 'success' ? <CheckCircle size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{log.officeName}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{log.email}</div>
                  {log.error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2, fontWeight: 500 }}>Warning: {log.error}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{log.status === 'success' ? 'Sent' : 'Failed'}</span>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{log.filesCount} file{log.filesCount !== 1 ? 's' : ''} · {fmtDate(log.sentAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
