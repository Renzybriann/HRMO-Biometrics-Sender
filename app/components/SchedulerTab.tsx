'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Office, SchedulerConfig } from '@/lib/types';

const DEFAULT_SCHEDULER: SchedulerConfig = {
  enabled: true,
  dayOfMonth: 15,
  hour: 8,
  minute: 0,
  sendIntervalSeconds: 30,
};

const pad = (n: number) => String(n).padStart(2, '0');

export function SchedulerTab({ scheduler, setScheduler, autoSend, onToggleAutoSend, scheduledOfficeIds, setScheduledOfficeIds, offices, showToast }: {
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
  const [activeSection, setActiveSection] = useState<'schedule' | 'sending' | 'offices'>('schedule');

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
      showToast(activeSection === 'sending' ? 'Sending settings saved' : 'Scheduler settings saved', 'success');
    } else showToast('Failed to save', 'error');
  };

  const nextRunDate = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), local.dayOfMonth, local.hour, local.minute);
    const target = d.getTime() > now.getTime()
      ? d
      : new Date(now.getFullYear(), now.getMonth() + 1, local.dayOfMonth, local.hour, local.minute);

    return target.toLocaleString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const noneSelected = localIds.length === 1 && localIds[0] === '__none__';
  const isOfficeSelected = (id: string) => !noneSelected && (localIds.length === 0 || localIds.includes(id));
  const selectedCount = noneSelected ? 0 : localIds.length === 0 ? offices.length : localIds.length;
  const saveLabel = activeSection === 'sending' ? 'Save Sending Settings' : 'Save Scheduler Settings';

  const toggleOffice = (id: string) => {
    if (noneSelected) {
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

  return (
    <div className="fade-up" style={{ maxWidth: 620 }}>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color="var(--yellow)" />
          </div>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>Auto-Send Schedule</h2>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Configure when and to whom emails are automatically sent.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: autoSend ? 'var(--blue-pale)' : 'var(--gray-100)', borderRadius: 8, marginBottom: 20, cursor: 'pointer' }}
          onClick={onToggleAutoSend}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: autoSend ? 'var(--blue)' : 'var(--gray-700)' }}>Auto-Send</div>
            <div style={{ fontSize: 12, color: autoSend ? 'var(--blue)' : 'var(--gray-500)', marginTop: 2 }}>
              {autoSend ? 'Emails will be sent automatically on schedule' : 'Auto-send is disabled - manual only'}
            </div>
          </div>
          {autoSend ? <ToggleRight size={28} color="var(--blue)" /> : <ToggleLeft size={28} color="var(--gray-400)" />}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--gray-100)', borderRadius: 8, padding: 4 }}>
          {(['schedule', 'sending', 'offices'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)} style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: activeSection === s ? '#fff' : 'transparent',
              color: activeSection === s ? 'var(--navy)' : 'var(--gray-500)',
              fontWeight: activeSection === s ? 700 : 500, fontSize: 13, fontFamily: 'inherit',
              boxShadow: activeSection === s ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {s === 'schedule' ? 'Schedule' : s === 'sending' ? 'Sending' : `Offices (${selectedCount}/${offices.length})`}
            </button>
          ))}
        </div>

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
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Hour (0-23)</div>
                  <input type="number" min={0} max={23} className="input" value={local.hour}
                    onChange={e => setLocal({ ...local, hour: Math.max(0, Math.min(23, +e.target.value)) })} />
                </div>
                <div style={{ fontSize: 20, color: 'var(--gray-300)', paddingTop: 18 }}>:</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Minute (0-59)</div>
                  <input type="number" min={0} max={59} className="input" value={local.minute}
                    onChange={e => setLocal({ ...local, minute: Math.max(0, Math.min(59, +e.target.value)) })} />
                </div>
                <div style={{ paddingTop: 18, fontSize: 14, fontWeight: 800, color: 'var(--navy)', flexShrink: 0 }}>
                  {pad(local.hour)}:{pad(local.minute)}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Next Scheduled Run</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{nextRunDate()}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
                Cron: <code style={{ fontSize: 11 }}>{local.minute} {local.hour} {local.dayOfMonth} * *</code>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'sending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Interval Between Emails</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="range"
                  min={5}
                  max={300}
                  step={5}
                  value={local.sendIntervalSeconds ?? DEFAULT_SCHEDULER.sendIntervalSeconds}
                  onChange={e => setLocal({ ...local, sendIntervalSeconds: +e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--blue)' }}
                />
                <input
                  type="number"
                  min={5}
                  max={300}
                  className="input"
                  value={local.sendIntervalSeconds ?? DEFAULT_SCHEDULER.sendIntervalSeconds}
                  onChange={e => setLocal({ ...local, sendIntervalSeconds: Math.max(5, Math.min(300, +e.target.value || DEFAULT_SCHEDULER.sendIntervalSeconds)) })}
                  style={{ width: 92 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', flexShrink: 0 }}>seconds</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 5 }}>
                Applies to manual Send Selected queues and scheduled auto-send batches.
              </div>
            </div>

            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Current Queue Timing</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
                {local.sendIntervalSeconds ?? DEFAULT_SCHEDULER.sendIntervalSeconds} seconds between offices
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>
                Single-office sends start immediately and do not use an interval.
              </div>
            </div>
          </div>
        )}

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
          {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} {saveLabel}
        </button>
      </div>
    </div>
  );
}
