'use client';

import { useState } from 'react';
import { Edit2, ExternalLink, Link, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import type { CutoffLabel } from '@/lib/types';

export function LabelsTab({ labels, onRefresh, showToast }: {
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

  const formatRange = (start: string, end: string) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const sMonth = s.toLocaleString('default', { month: 'long' });
    const eMonth = e.toLocaleString('default', { month: 'long' });
    const year = s.getFullYear();
    if (sMonth === eMonth) return `${sMonth} ${s.getDate()}-${e.getDate()}, ${year}`;
    return `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}, ${year}`;
  };

  const grouped = labels.reduce<Record<number, Record<number, CutoffLabel[]>>>((acc, l) => {
    const d = new Date(l.startDate + 'T00:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          Quick-access shortcuts to cutoff period tracking links, sorted by date.
        </p>
        <button className="btn btn-navy btn-sm" onClick={() => { resetForm(); setShowAdd(true); setEditId(null); }}>
          <Plus size={13} /> Add Label
        </button>
      </div>

      {(showAdd || editId) && (
        <div className="card slide-down" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--navy)' }}>
            {editId ? 'Edit Cutoff Label' : 'New Cutoff Label'}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label className="label">End Date</label>
              <input className="input" type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
            </div>
            <div style={{ flex: '2 1 260px' }}>
              <label className="label">URL</label>
              <input className="input" value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://..." type="url" />
            </div>
          </div>

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

      {years.map(year => {
        const months = Object.keys(grouped[year]).map(Number).sort((a, b) => a - b);
        return (
          <div key={year} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>{year}</div>
              <div style={{ flex: 1, height: 2, background: 'var(--gray-200)', borderRadius: 99 }} />
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                {labels.filter(l => new Date(l.startDate).getFullYear() === year).length} periods
              </span>
            </div>

            {months.map(month => (
              <div key={month} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 2 }}>
                  {monthNames[month]}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {grouped[year][month].map(label => (
                    <div key={label.id} style={{
                      display: 'flex', alignItems: 'center', gap: 0,
                      border: '1.5px solid var(--gray-200)', borderRadius: 8,
                      overflow: 'hidden', background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
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
                      <button onClick={() => {
                        setEditId(label.id);
                        setFormStart(label.startDate);
                        setFormEnd(label.endDate);
                        setFormUrl(label.url);
                        setShowAdd(false);
                      }} style={{ padding: '10px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', display: 'flex', borderRight: '1.5px solid var(--gray-200)' }}>
                        <Edit2 size={12} />
                      </button>
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
