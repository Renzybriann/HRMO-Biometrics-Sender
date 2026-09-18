'use client';

import React from 'react';
import { BookOpen, Building2, Calendar, Clock, Link, LogOut, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

export type Tab = 'offices' | 'templates' | 'scheduler' | 'logs' | 'labels' | 'admin';

export function Sidebar({ active, onChange, logCount }: { active: Tab; onChange: (t: Tab) => void; logCount: number }) {
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
