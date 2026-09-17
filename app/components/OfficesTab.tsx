'use client';

import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Building2, CheckCircle, CheckSquare, ChevronDown, ChevronUp, Edit2, FileText,
  Mail, Maximize2, Minimize2, Paperclip, Plus, RefreshCw, RotateCcw, Save, Send,
  Square, Trash2, Upload, X, XCircle,
} from 'lucide-react';
import type { EmailTemplate, Office, PDFFile, QueueItem } from '@/lib/types';

const fmt = (b: number) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

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
  officeId: string;
  files: PDFFile[];
  uploading: boolean;
  onUpload: (id: string, files: FileList) => void;
  onDelete: (id: string, name: string) => void;
  onClickUpload: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
          <Upload size={11} /> {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

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
          pointerEvents: 'all',
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--blue)', fontSize: 11, pointerEvents: 'none' }}>
            <RefreshCw size={12} className="spin" /> Uploading...
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

export function OfficesTab({ offices, sendingId, queueMap, templates, activeTemplateId, onSendOne, onSendSelected, onRefresh, showToast }: {
  offices: Office[];
  sendingId: string | null;
  queueMap: Record<string, QueueItem>;
  templates: EmailTemplate[];
  activeTemplateId: string;
  onSendOne: (id: string, templateId?: string) => void;
  onSendSelected: (ids: string[], templateId?: string) => void;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState(activeTemplateId);
  const [openPdfs, setOpenPdfs] = useState<Set<string>>(new Set());
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set<string>(['__all__']));
  const allCollapsed = offices.length > 0 && offices.every(o => collapsedCards.has(o.id));
  const allSelected = offices.length > 0 && selected.size === offices.length;

  const fetchPDFs = async (id: string) => {
    const res = await fetch(`/api/upload?officeId=${id}`);
    const d = await res.json();
    setPdfMap(p => ({ ...p, [id]: d.files || [] }));
  };

  useEffect(() => {
    offices.forEach(async (o) => {
      await fetchPDFs(o.id);
    });
  }, [offices.length]);

  useEffect(() => {
    if (offices.length > 0) {
      setCollapsedCards(new Set(offices.map(o => o.id)));
    }
  }, [offices.length]);

  useEffect(() => {
    if (!templates.some(t => t.id === selectedTemplateId)) {
      setSelectedTemplateId(activeTemplateId);
    }
  }, [activeTemplateId, selectedTemplateId, templates]);

  useEffect(() => {
    const noAttachment = offices.filter(o => pdfMap[o.id] !== undefined && pdfMap[o.id].length === 0);
    if (noAttachment.length > 0) {
      setOpenPdfs(prev => {
        const next = new Set(prev);
        noAttachment.forEach(o => next.add(o.id));
        return next;
      });
    }
  }, [pdfMap, offices]);

  const togglePdf = async (id: string) => {
    const next = new Set(openPdfs);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!pdfMap[id]) await fetchPDFs(id);
    }
    setOpenPdfs(next);
  };

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsedCards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsedCards(next);
  };

  const toggleCollapseAll = () => {
    if (allCollapsed) setCollapsedCards(new Set());
    else setCollapsedCards(new Set(offices.map(o => o.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(offices.map(o => o.id)));
  };

  const resetForm = () => {
    setFormName('');
    setFormEmails(['']);
    setFormError('');
    setFormSortOrder(0);
  };

  const saveOffice = async (isEdit: boolean, officeId?: string) => {
    setFormError('');
    const cleanEmails = formEmails.map(e => e.trim()).filter(Boolean);
    if (!formName.trim() || cleanEmails.length === 0) {
      setFormError('Name and at least one email required.');
      return;
    }

    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit
      ? { id: officeId, name: formName.trim(), emails: cleanEmails, sortOrder: formSortOrder }
      : { name: formName.trim(), emails: cleanEmails };
    const res = await fetch('/api/offices', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const e = await res.json();
      setFormError(e.error || 'Failed');
      return;
    }

    resetForm();
    setShowAdd(false);
    setEditId(null);
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
  const chosenTemplate = templates.find(t => t.id === selectedTemplateId) ?? templates.find(t => t.id === activeTemplateId) ?? templates[0];
  const sendTemplateId = chosenTemplate?.id ?? activeTemplateId;

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={toggleSelectAll} style={{ gap: 6 }}>
          {allSelected ? <CheckSquare size={13} color="var(--blue)" /> : <Square size={13} />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>

        <button className="btn btn-ghost btn-sm" onClick={toggleCollapseAll}>
          {allCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          {allCollapsed ? 'Expand All' : 'Collapse All'}
        </button>

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <label className="label" style={{ margin: 0, fontSize: 11 }}>Template</label>
          <select
            className="input"
            value={sendTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            style={{ width: 220, padding: '6px 10px', fontSize: 12 }}
            title="Email template to use for manual sends"
          >
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}{template.id === activeTemplateId ? ' (Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <button className="btn btn-yellow btn-sm" onClick={() => onSendSelected(selectedIds, sendTemplateId)}>
              <Send size={13} /> Send Selected ({selected.size})
            </button>
          )}
          <button className="btn btn-navy btn-sm" onClick={() => { resetForm(); setShowAdd(true); setEditId(null); }}>
            <Plus size={13} /> Add Office
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="slide-down" style={{ background: 'var(--blue-pale)', border: '1px solid var(--blue)', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckSquare size={14} color="var(--blue)" />
          <span style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>{selected.size} office{selected.size > 1 ? 's' : ''} selected</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}><X size={12} /> Clear</button>
        </div>
      )}

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
          const cardBorder = pdfsLoaded ? hasPdfs ? '2px solid #3b8de0' : '2px solid var(--danger)' : '1px solid var(--gray-200)';

          return (
            <div key={office.id} className={`card fade-up d${Math.min(i + 1, 5)}`}
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', border: isSelected ? '2px solid var(--blue)' : cardBorder, transition: 'border 0.15s', position: 'relative' }}>

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
                        onClick={() => { setEditId(office.id); setFormName(office.name); setFormEmails([...(office.emails ?? [''])]); setFormError(''); setFormSortOrder(office.sortOrder ?? 0); }}>
                        <Edit2 size={12} />
                      </button>
                      <button className="btn btn-icon btn-sm" style={{ background: 'rgba(220,38,38,0.25)', color: '#fca5a5', borderRadius: 6 }} onClick={() => deleteOffice(office.id, office.name)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

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

                      {qItem && qItem.status !== 'pending' && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: qColors[qItem.status], background: `${qColors[qItem.status]}18`, padding: '3px 7px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {qItem.status === 'sending' && <><RefreshCw size={9} className="spin" />Sending...</>}
                          {qItem.status === 'retrying' && <><RotateCcw size={9} />Retry {qItem.attempt}...</>}
                          {qItem.status === 'sent' && <><CheckCircle size={9} />Sent</>}
                          {qItem.status === 'failed' && <><XCircle size={9} />Failed</>}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(office.emails ?? []).map((email, ei) => (
                          <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--gray-500)', overflow: 'hidden' }}>
                            <Mail size={9} color="var(--blue)" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                          </div>
                        ))}
                      </div>

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
                              : 'No attachments'
                            : <RefreshCw size={9} className="spin" />}
                          {isPdfOpen ? <ChevronUp size={10} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={10} style={{ marginLeft: 'auto' }} />}
                        </button>

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

                      <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 'auto' }}
                        disabled={isSending || !!qItem} onClick={() => onSendOne(office.id, sendTemplateId)}>
                        {isSending ? <RefreshCw size={12} className="spin" /> : <Send size={12} />}
                        {qItem ? (qItem.status === 'sent' ? 'Sent' : qItem.status === 'failed' ? 'Failed' : qItem.status === 'pending' ? 'Queued' : 'Sending...') : 'Send Report'}
                      </button>
                    </div>
                  )}

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
