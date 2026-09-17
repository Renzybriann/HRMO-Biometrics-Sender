'use client';

import { useRef, useState } from 'react';
import { BookOpen, CheckCircle, Eye, EyeOff, Plus, RefreshCw, Save, Trash } from 'lucide-react';
import type { EmailTemplate } from '@/lib/types';

export function TemplatesTab({ templates, activeTemplateId, setActiveTemplateId, onRefresh, showToast }: {
  templates: EmailTemplate[];
  activeTemplateId: string;
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

  const openEdit = (t: EmailTemplate) => {
    setEditId(t.id);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setShowNew(false);
    setPreview(false);
  };

  const openNew = () => {
    setEditId(null);
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setShowNew(true);
    setPreview(false);
  };

  const saveTemplate = async (isNew: boolean) => {
    if (!formName || !formSubject || !formBody) {
      showToast('All fields required', 'error');
      return;
    }

    setSaving(true);
    const method = isNew ? 'POST' : 'PUT';
    const body = isNew
      ? { name: formName, subject: formSubject, body: formBody }
      : { id: editId, name: formName, subject: formSubject, body: formBody };

    const res = await fetch('/api/settings', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      showToast(isNew ? 'Template created' : 'Template saved', 'success');
      setShowNew(false);
      setEditId(null);
      await onRefresh();
    } else {
      showToast('Failed to save', 'error');
    }
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
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTemplateId: id }),
    });
    showToast('Active template updated', 'success');
  };

  const previewText = (text: string) =>
    text.replace(/\{\{officeName\}\}/g, 'Human Resource Office')
      .replace(/\{\{month\}\}/g, new Date().toLocaleString('default', { month: 'long', year: 'numeric' }))
      .replace(/\{\{monthYear\}\}/g, new Date().toLocaleString('default', { month: 'long', year: 'numeric' }))
      .replace(/\{\{period\}\}/g, 'September 1-15, 2026')
      .replace(/\{\{payPeriod\}\}/g, '1 - 15')
      .replace(/\{\{periodStart\}\}/g, 'September 1, 2026')
      .replace(/\{\{periodEnd\}\}/g, 'September 15, 2026')
      .replace(/\{\{senderName\}\}/g, 'Biometrics Department');

  const renderPreview = (text: string) =>
    text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:10px 0"/>')
      .split('\n').map(l => l.trim() === '' ? '<br/>' : `<p style="margin:0 0 5px;font-size:13px;line-height:1.7;">${l}</p>`).join('');

  const wrapSelection = (before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    setFormBody(formBody.substring(0, s) + before + formBody.substring(s, e) + after + formBody.substring(e));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, e + before.length);
    }, 0);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    setFormBody(formBody.substring(0, s) + text + formBody.substring(s));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + text.length, s + text.length);
    }, 0);
  };

  const placeholders = ['{{officeName}}', '{{period}}', '{{monthYear}}', '{{payPeriod}}', '{{senderName}}'];

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
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

              <div style={{ background: 'var(--blue-pale)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Insert:</span>
                {placeholders.map(p => (
                  <button key={p} onClick={() => insertAtCursor(p)}
                    style={{ background: '#fff', color: 'var(--blue)', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid rgba(29,111,206,0.2)', cursor: 'pointer', fontFamily: 'monospace' }}>{p}</button>
                ))}
              </div>

              <div><label className="label">Subject</label>
                {preview ? <div style={{ padding: '9px 12px', background: 'var(--gray-50)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600 }}>{previewText(formSubject)}</div>
                  : <input className="input" value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder="Email subject..." />}
              </div>

              <div><label className="label">Body</label>
                {!preview && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4, padding: '5px 8px', background: 'var(--gray-100)', borderRadius: '6px 6px 0 0', border: '1.5px solid var(--gray-200)', borderBottom: 'none' }}>
                    {[{ l: 'B', s: { fontWeight: 800 as const }, a: () => wrapSelection('**', '**') }, { l: 'I', s: { fontStyle: 'italic' as const }, a: () => wrapSelection('*', '*') }, { l: '-', s: {}, a: () => insertAtCursor('\n---\n') }].map(b => (
                      <button key={b.l} onClick={b.a} style={{ ...b.s, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 4, width: 26, height: 24, cursor: 'pointer', fontSize: 12, color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>{b.l}</button>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--gray-300)', alignSelf: 'center', marginLeft: 6 }}>**bold** | *italic* | --- divider</span>
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
