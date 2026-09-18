'use client';

import { useRef, useState } from 'react';
import { BookOpen, CheckCircle, Eye, EyeOff, Plus, RefreshCw, Save, Trash } from 'lucide-react';
import type { EmailSections, EmailTemplate } from '@/lib/types';
import { DEFAULT_INTRO, DEFAULT_SECTIONS } from '@/lib/email-content';

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
  const [sections, setSections] = useState<EmailSections>(DEFAULT_SECTIONS);
  const [rendered, setRendered] = useState<{ subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewWidth, setPreviewWidth] = useState('100%');
  const previewRequest = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openEdit = (t: EmailTemplate) => {
    if (saving) return;
    previewRequest.current += 1;
    setPreviewLoading(false);
    setSections(structuredClone(t.sections ?? DEFAULT_SECTIONS));
    setRendered(null);
    setEditId(t.id);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setShowNew(false);
    setPreview(false);
  };

  const openNew = () => {
    if (saving) return;
    previewRequest.current += 1;
    setPreviewLoading(false);
    setSections(structuredClone(DEFAULT_SECTIONS));
    setRendered(null);
    setEditId(null);
    setFormName('');
    setFormSubject('Biometric Attendance Data - {{period}} | {{officeName}}');
    setFormBody(DEFAULT_INTRO);
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
      ? { name: formName, subject: formSubject, body: formBody, sections }
      : { id: editId, name: formName, subject: formSubject, body: formBody, sections };

    try {
      const res = await fetch('/api/settings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        previewRequest.current += 1;
        setPreviewLoading(false);
        showToast(isNew ? 'Template created' : 'Template saved', 'success');
        setShowNew(false);
        setEditId(null);
        await onRefresh();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch { showToast('Could not save template. Please retry.', 'error'); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/settings?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete template');
      previewRequest.current += 1;
      setPreviewLoading(false);
      if (editId === id) setEditId(null);
      await onRefresh();
      showToast('Template deleted', 'info');
    } catch (err) { showToast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const setActive = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeTemplateId: id }),
      });
      if (!res.ok) throw new Error('Could not activate template');
      setActiveTemplateId(id);
      showToast('Active template updated', 'success');
    } catch (err) { showToast((err as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const togglePreview = async () => {
    if (preview) { setPreview(false); return; }
    const request = ++previewRequest.current;
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/templates/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, subject: formSubject, body: formBody, sections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not render preview');
      if (request === previewRequest.current) { setRendered(data); setPreview(true); }
    } catch (err) { if (request === previewRequest.current) showToast((err as Error).message, 'error'); }
    finally { if (request === previewRequest.current) setPreviewLoading(false); }
  };

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
    <div className="fade-up" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 220px', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

      <div style={{ flex: '4 1 420px', minWidth: 0, maxWidth: '100%' }}>
        {!editId && !showNew ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-500)' }}>
            <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>Select a template to edit or create a new one.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy)' }}>{showNew ? 'New Template' : 'Edit Template'}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {editId && editId !== 'default' && !templates.find(t => t.id === editId)?.isDefault && (
                  <button className="btn btn-danger btn-sm" disabled={saving} onClick={() => deleteTemplate(editId)}><Trash size={12} /> Delete</button>
                )}
                {editId && editId !== activeTemplateId && (
                  <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setActive(editId)}><CheckCircle size={12} /> Set Active</button>
                )}
                <button className="btn btn-ghost btn-sm" disabled={previewLoading || saving} onClick={togglePreview}>
                  {preview ? <EyeOff size={12} /> : <Eye size={12} />} {preview ? 'Edit' : 'Preview'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => saveTemplate(showNew)} disabled={saving}>
                  {saving ? <RefreshCw size={12} className="spin" /> : <Save size={12} />} Save
                </button>
              </div>
            </div>

            {preview && rendered ? <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <strong style={{ overflowWrap: 'anywhere', fontSize: 14 }}>{rendered.subject}</strong>
                <select className="input" aria-label="Preview width" style={{ width: 'auto' }} value={previewWidth} onChange={e => setPreviewWidth(e.target.value)}><option value="100%">Desktop</option><option value="375px">Mobile</option></select>
              </div>
              <iframe title="Email preview" sandbox="" srcDoc={rendered.html} style={{ display: 'block', width: previewWidth, maxWidth: '100%', height: 1000, margin: '0 auto', border: '1px solid var(--gray-200)' }} />
            </div> : <fieldset disabled={saving || previewLoading} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="label">Template Name</label><input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Monthly Biometrics" /></div>

              <div style={{ background: 'var(--blue-pale)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Insert:</span>
                {placeholders.map(p => (
                  <button key={p} onClick={() => insertAtCursor(p)}
                    style={{ background: '#fff', color: 'var(--blue)', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid rgba(29,111,206,0.2)', cursor: 'pointer', fontFamily: 'monospace' }}>{p}</button>
                ))}
              </div>

              <div><label className="label">Subject</label>
                <input className="input" value={formSubject} onChange={e => setFormSubject(e.target.value)} placeholder="Email subject..." />
              </div>

              <div><label className="label" htmlFor="template-intro">Introduction / Message</label>
                {!preview && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4, padding: '5px 8px', background: 'var(--gray-100)', borderRadius: '6px 6px 0 0', border: '1.5px solid var(--gray-200)', borderBottom: 'none' }}>
                    {[{ l: 'B', s: { fontWeight: 800 as const }, a: () => wrapSelection('**', '**') }, { l: 'I', s: { fontStyle: 'italic' as const }, a: () => wrapSelection('*', '*') }, { l: '-', s: {}, a: () => insertAtCursor('\n---\n') }].map(b => (
                      <button key={b.l} onClick={b.a} style={{ ...b.s, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 4, width: 26, height: 24, cursor: 'pointer', fontSize: 12, color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>{b.l}</button>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--gray-300)', alignSelf: 'center', marginLeft: 6 }}>**bold** | *italic* | --- divider</span>
                  </div>
                )}
                <textarea id="template-intro" ref={textareaRef} className="textarea" value={formBody} onChange={e => setFormBody(e.target.value)} style={{ minHeight: 160, borderRadius: '0 0 6px 6px' }} />
              </div>
              {(['action', 'reminder'] as const).map(key => <label key={key} className="label">{key === 'action' ? 'Action Required' : 'Submission Reminder'}<textarea className="textarea" value={sections[key]} onChange={e => setSections({ ...sections, [key]: e.target.value })} style={{ minHeight: 110, fontWeight: 400 }} /></label>)}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><span className="label">Submission Deadlines</span><button type="button" className="btn btn-ghost btn-sm" disabled={sections.deadlines.length >= 12} onClick={() => setSections({ ...sections, deadlines: [...sections.deadlines, { period: '', deadline: '' }] })}><Plus size={14} /> Add Row</button></div>
                {sections.deadlines.map((row, index) => <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'end' }}>
                  <label className="label" style={{ flex: '1 1 100px', minWidth: 0 }}>Pay Period<input className="input" value={row.period} onChange={e => setSections({ ...sections, deadlines: sections.deadlines.map((r, i) => i === index ? { ...r, period: e.target.value } : r) })} /></label>
                  <label className="label" style={{ flex: '3 1 180px', minWidth: 0 }}>Deadline<input className="input" value={row.deadline} onChange={e => setSections({ ...sections, deadlines: sections.deadlines.map((r, i) => i === index ? { ...r, deadline: e.target.value } : r) })} /></label>
                  <button type="button" className="btn btn-danger btn-sm" title="Remove deadline" aria-label={`Remove deadline ${index + 1}`} onClick={() => setSections({ ...sections, deadlines: sections.deadlines.filter((_, i) => i !== index) })}><Trash size={14} /></button>
                </div>)}
              </div>
              {(['acknowledgement', 'closing'] as const).map(key => <label key={key} className="label">{key === 'closing' ? 'Closing' : 'Acknowledgement'}<textarea className="textarea" value={sections[key]} onChange={e => setSections({ ...sections, [key]: e.target.value })} style={{ minHeight: 80, fontWeight: 400 }} /></label>)}
            </fieldset>}
          </>
        )}
      </div>
    </div>
  );
}
