import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { templates } from '../templates/original';
import seedFeedback from '../templates/seed.json';
import { renderTree, hasClass, patch } from '../lib';
import { useApp, toFa, uid, norm, timeAgo, shamsi } from '../state';
import { cleanHtml, richText, fbHtml, itemHtml, focusEditor, inQuote, applyCommand, pastePlain, enterQuote, fmtSize, brief, csvCell, esc } from './feedbackRich';

const MAX = 2000;
const AUTHOR = 'ستایش قبادی';
const COMMANDS = ['underline', 'quote', 'italic', 'bold'];
const TITLES = ['زیرخط (Ctrl+U)', 'نقل‌قول', 'ایتالیک (Ctrl+I)', 'پررنگ (Ctrl+B)', 'پیوست فایل'];

function find(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (!React.isValidElement(node)) return Array.isArray(node) ? node.map(textOf).join('') : String(node);
  return React.Children.toArray(node.props.children).map(textOf).join('');
}
function people() {
  const labels = templates.people || [];
  return labels.map((label, index) => {
    const avatar = find(label, n => hasClass(n, 'tb4-avatar') || hasClass(n, 'tb4-avatar-img'));
    const checkbox = find(label, n => hasClass(n, 'tb4-chk'));
    return { index, label, avatar, name: norm(textOf(find(label, n => hasClass(n, 'tb4-name')))), checked: !!(checkbox?.props.defaultChecked || checkbox?.props.checked) };
  });
}
function activate(event, callback) {
  if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault(); callback();
}
function addLog(draft, text) {
  draft.logs = [{ ts: Date.now(), text, user: AUTHOR }, ...(draft.logs || [])].slice(0, 100);
}
function replyFor(item) {
  if (!item) return null;
  let text = String(item.text || '').split('\n').map(l => norm(l.replace(/^\s*>\s?/, '').replace(/(\*\*|\+\+)/g, ''))).find(l => l && !/^!\[/.test(l)) || '[تصویر]';
  if (text.length > 120) text = text.slice(0, 120) + '…';
  return { id: item.id, author: item.author, text };
}

function Card({ item, visible, onReply, persons, onLayout }) {
  const { update, toast } = useApp();
  const [editing, setEditing] = useState(false);
  const editRef = useRef(null);
  const cardRef = useRef(null);
  useLayoutEffect(() => { if (editing) focusEditor(editRef.current); onLayout?.(); }, [editing, onLayout]);
  const remove = () => {
    let index;
    update(draft => { index = draft.feedbacks.findIndex(f => f.id === item.id); draft.feedbacks = draft.feedbacks.filter(f => f.id !== item.id); addLog(draft, 'بازخورد «' + brief(item.text) + '» حذف شد'); });
    window.dispatchEvent(new CustomEvent('bioarc:feedback-removed', { detail: { id: item.id } }));
    toast('بازخورد حذف شد', 'بازگردانی', () => update(draft => { draft.feedbacks.splice(Math.min(index ?? 0, draft.feedbacks.length), 0, item); addLog(draft, 'بازخورد «' + brief(item.text) + '» بازگردانی شد'); }));
  };
  const saveEdit = () => {
    const html = cleanHtml(editRef.current.innerHTML), text = richText(html);
    if (!text) { toast('متن بازخورد نمی‌تواند خالی باشد'); return; }
    if (editRef.current.textContent.length > MAX) { toast('متن بازخورد نباید بیشتر از ' + toFa(MAX) + ' کاراکتر باشد'); return; }
    if (html !== cleanHtml(item.html || fbHtml(item.text))) update(draft => {
      const current = draft.feedbacks.find(f => f.id === item.id);
      if (current) Object.assign(current, { html, text, edited: true });
      addLog(draft, 'بازخورد «' + brief(text) + '» ویرایش شد');
    });
    setEditing(false);
  };
  const changeStatus = () => update(draft => {
    const current = draft.feedbacks.find(f => f.id === item.id);
    if (!current) return;
    current.approved = !current.approved;
    addLog(draft, 'وضعیت بازخورد «' + brief(current.text) + '» به «' + (current.approved ? 'تایید شده' : 'تایید نشده') + '» تغییر کرد');
  });
  const reference = () => {
    const target = [...document.querySelectorAll('.fb-new')].find(el => el.dataset.fbId === item.replyTo?.id);
    if (!target) { toast('بازخورد اصلی دیگر وجود ندارد'); return; }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('fb-flash');
    setTimeout(() => target.classList.remove('fb-flash'), 1400);
  };
  const header = find(templates.feedbackCard, n => hasClass(n, 'toolbar2-header'));
  const heading = renderTree(header, node => {
    if (hasClass(node, 'toolbar2-name')) return patch(node, {}, item.author);
    if (hasClass(node, 'toolbar2-user-name') && item.author === AUTHOR) return patch(node, {}, React.Children.toArray(node.props.children).map((child, i) => React.isValidElement(child) && child.type === 'svg' ? <img key={i} className="fb-author-img" alt="" src="./image/dr.png" /> : child));
    if (hasClass(node, 'icon-btn')) {
      const action = node.props.title;
      const handler = action === 'حذف' ? remove : action === 'ویرایش' ? () => { setEditing(true); if (editing) focusEditor(editRef.current); } : () => onReply(item);
      const cls = action === 'حذف' ? 'fb-del' : action === 'ویرایش' ? 'fb-edit' : 'fb-reply';
      return patch(node, { type: 'button', className: `${node.props.className} ${cls}`, onClick: handler });
    }
    if (hasClass(node, 'status-badge')) return patch(node, { className: `status-badge fb-status ${item.approved ? 'badge-green' : 'badge-red'}`, role: 'button', tabIndex: 0, title: 'تغییر وضعیت', onClick: changeStatus, onKeyDown: e => activate(e, changeStatus) }, [<span className="white-dot" key="dot" />, <span key="label">{item.approved ? 'تایید شده' : 'تایید نشده'}</span>]);
    if (hasClass(node, 'avatar-group')) return patch(node, {}, (item.mentions || []).map(name => {
      const p = persons.find(person => person.name === name);
      if (!p) return null;
      if (p.avatar?.type === 'img') return <img key={name} className="avatar-circle-img" src={p.avatar.props.src} title={name} alt="" />;
      const svg = find(p.avatar, n => n.type === 'svg');
      return svg ? patch(svg, { key: name, title: name }) : null;
    }));
    if (hasClass(node, 'mention-section')) return patch(node, { style: { ...(node.props.style || {}), display: (item.mentions || []).some(name => persons.some(p => p.name === name)) ? undefined : 'none' } });
    return node;
  });
  const divider = find(templates.feedbackCard, n => hasClass(n, 'line-divider3'));
  const clip = find(templates.feedbackForm, n => hasClass(n, 'tb4-tools'));
  const clipButton = clip ? React.Children.toArray(clip.props.children).filter(React.isValidElement).at(4) : null;
  const clipSvg = find(clipButton, n => n.type === 'svg');
  return <div ref={cardRef} className="feedback-toolbar2 fb-new" data-fb-id={item.id} style={{ display: visible ? undefined : 'none' }}>
    {heading}{divider}
    {item.replyTo && <div className="fb-quote fb-reply-ref" role="button" tabIndex={0} title="رفتن به بازخورد اصلی" data-ref={item.replyTo.id} onClick={reference} onKeyDown={e => activate(e, reference)}><strong>{item.replyTo.author}: </strong><span>{item.replyTo.text}</span></div>}
    <div className="fb-body" style={{ display: editing ? 'none' : undefined }} dangerouslySetInnerHTML={{ __html: itemHtml(item) }} />
    {editing && <div className="fb-edit-box">
      <div className="fb-edit-tools" role="toolbar" aria-label="قالب‌بندی متن">{[['bold', 'B', 'پررنگ (Ctrl+B)'], ['italic', 'I', 'ایتالیک (Ctrl+I)'], ['underline', 'U', 'زیرخط (Ctrl+U)'], ['quote', '❝', 'نقل‌قول']].map(([cmd, label, title]) => <button type="button" key={cmd} className="fb-edit-tool" data-cmd={cmd} title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => applyCommand(editRef.current, cmd)}>{label}</button>)}</div>
      <div className="fb-edit-input" ref={editRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" dir="rtl" dangerouslySetInnerHTML={{ __html: cleanHtml(item.html || fbHtml(item.text)) }} onPaste={e => pastePlain(e, editRef.current)} onDrop={e => { if (e.dataTransfer.files.length) e.preventDefault(); }} onKeyDown={e => { enterQuote(e, editRef.current); if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveEdit(); } else if (e.key === 'Escape') setEditing(false); }} />
      <div className="fb-edit-actions"><button type="button" className="fb-btn fb-btn-primary fb-save" onClick={saveEdit}>ذخیره</button><button type="button" className="fb-btn fb-cancel" onClick={() => setEditing(false)}>انصراف</button></div>
    </div>}
    {!!item.files?.length && <div className="fb-files fb-files-card">{item.files.map((f, i) => <span key={i} className="fb-file-chip">{clipSvg && patch(clipSvg, { className: 'fb-clip' })}<span className="fb-file-name">{f.name}</span><span className="fb-file-size">{fmtSize(f.size)}</span></span>)}</div>}
    {!!(item.ts || item.edited) && <div className="fb-time" data-ts={item.ts || undefined} title={item.ts ? shamsi(item.ts) : undefined}>{item.ts ? timeAgo(item.ts) : ''}{item.edited && <span className="fb-edited">{item.ts ? ' · ' : ''}ویرایش شده</span>}</div>}
  </div>;
}

export default function Activities() {
  const { state, update, toast } = useApp();
  const persons = people();
  const defaults = () => persons.filter(p => p.checked).map(p => p.name);
  const [mentions, setMentions] = useState(defaults);
  const [files, setFiles] = useState([]);
  const [reply, setReply] = useState(() => replyFor(state.feedbacks?.find(f => f.id === 'seed-1')));
  const [tab, setTab] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [popup, setPopup] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);
  const [commands, setCommands] = useState([]);
  // رفتار دکمه‌های موجود در SVG اصلی؛ بدون تغییر اندازه یا ظاهر آیکون‌ها.
  const [draftApproved, setDraftApproved] = useState(true);
  const editorHistoryRef = useRef([]);
  const previousEditorHtmlRef = useRef('');
  const [, tick] = useState(0);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const requestLayout = useCallback(() => setLayoutRevision(n => n + 1), []);
  const rootRef = useRef(null), editorRef = useRef(null), fileRef = useRef(null), busyRef = useRef(false), initialized = useRef(false);
  const seedRef = useRef(seedFeedback);
  useLayoutEffect(() => {
    if (initialized.current || !editorRef.current) return;
    initialized.current = true;
    editorRef.current.innerHTML = cleanHtml(state.draft || '');
    previousEditorHtmlRef.current = editorRef.current.innerHTML;
    setCount(editorRef.current.textContent.length);
    try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch {}
  }, [state.draft]);
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 60000);
    const outside = e => { if (!e.target.closest('.tb4-pop, .tb4-tag-lbl')) setPopup(false); };
    const selection = () => {
      if (document.activeElement !== editorRef.current) { setCommands([]); return; }
      setCommands(COMMANDS.map(cmd => { try { return cmd === 'quote' ? inQuote(editorRef.current) : !!document.queryCommandState(cmd); } catch { return false; } }));
    };
    const reveal = e => { if (e.detail?.element && rootRef.current?.contains(e.detail.element)) { setCollapsed(false); if (e.detail.element.closest('.fb-new, .feedback-toolbar3')) setTab(0); } };
    const removed = e => setReply(previous => previous?.id === e.detail.id ? null : previous);
    const limit = e => { if (/^insert/.test(e.inputType || '') && e.inputType !== 'insertFromPaste' && editorRef.current?.textContent.length >= MAX && window.getSelection()?.isCollapsed) e.preventDefault(); };
    const input = editorRef.current; input?.addEventListener('beforeinput', limit);
    document.addEventListener('mousedown', outside); document.addEventListener('selectionchange', selection); window.addEventListener('bioarc:reveal', reveal); window.addEventListener('bioarc:feedback-removed', removed);
    return () => { input?.removeEventListener('beforeinput', limit); clearInterval(timer); document.removeEventListener('mousedown', outside); document.removeEventListener('selectionchange', selection); window.removeEventListener('bioarc:reveal', reveal); window.removeEventListener('bioarc:feedback-removed', removed); };
  }, []);
  useLayoutEffect(() => {
    const fit = () => {
      const root = rootRef.current, tagBox = root?.querySelector('.tb4-tag-box');
      if (!tagBox) return;
      const extra = Math.max(0, Math.round(tagBox.getBoundingClientRect().height - 42));
      root.querySelectorAll('.toolbar4').forEach(el => el.style.setProperty('--fb-extra', extra + 'px'));
      const parents = []; let parent = tagBox.parentElement;
      while (parent) { if (parent.matches('.tab-content, .activities-top, .file-details3, .file-details-main, .file-details')) parents.push(parent); parent = parent.parentElement; }
      parents.forEach(el => { el.style.height = ''; });
      if (window.innerWidth <= 1100 || collapsed || tab !== 0) return;
      const footer = tagBox.closest('.tb4-footer'), content = tagBox.closest('.tab-content');
      const over = footer.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom;
      if (over > 0) parents.forEach(el => { const h = parseFloat(getComputedStyle(el).height); if (h > 0) el.style.height = (h + Math.ceil(over) + 8) + 'px'; });
    };
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, [mentions, files, reply, state.feedbacks, tab, collapsed, layoutRevision]);
  function editorInput() {
    const el = editorRef.current;
    if (!el) return;
    if (!el.textContent.replace(/\u00a0/g, ' ').trim() && !el.querySelector('img')) el.innerHTML = '';
    const html = cleanHtml(el.innerHTML);
    if (html !== previousEditorHtmlRef.current) {
      editorHistoryRef.current.push(previousEditorHtmlRef.current);
      if (editorHistoryRef.current.length > 100) editorHistoryRef.current.shift();
      previousEditorHtmlRef.current = html;
    }
    setCount(el.textContent.length);
    update(draft => { if (html) draft.draft = html; else delete draft.draft; });
  }
  function resetForm(clearReply = true) {
    if (editorRef.current) editorRef.current.innerHTML = '';
    if (fileRef.current) fileRef.current.value = '';
    editorHistoryRef.current = [];
    previousEditorHtmlRef.current = '';
    setCount(0); setFiles([]); setMentions(defaults()); setPopup(false); setDraftApproved(true);
    if (clearReply) setReply(null);
    update(draft => { delete draft.draft; });
  }
  function clearDraft() {
    const snapshot = {
      html: cleanHtml(editorRef.current?.innerHTML || ''),
      files: [...files], mentions: [...mentions],
      reply: reply ? { ...reply } : null, approved: draftApproved,
    };
    if (!snapshot.html && !snapshot.files.length && !snapshot.reply && !snapshot.mentions.length && snapshot.approved) {
      toast('فرم بازخورد خالی است');
      return;
    }
    resetForm();
    toast('متن بازخورد پاک شد', 'بازگردانی', () => {
      if (editorRef.current) editorRef.current.innerHTML = snapshot.html;
      previousEditorHtmlRef.current = snapshot.html;
      editorHistoryRef.current = [];
      setCount(editorRef.current?.textContent.length || 0);
      setFiles(snapshot.files);
      setMentions(snapshot.mentions);
      setReply(snapshot.reply);
      setDraftApproved(snapshot.approved);
      update(draft => { if (snapshot.html) draft.draft = snapshot.html; else delete draft.draft; });
    });
  }
  function editDraft() {
    setTab(0);
    editorRef.current?.focus();
  }
  function undoDraft() {
    const editor = editorRef.current;
    if (!editor) return;
    if (!editorHistoryRef.current.length) {
      toast('تغییری برای بازگردانی وجود ندارد');
      return;
    }
    const html = editorHistoryRef.current.pop();
    editor.innerHTML = html;
    previousEditorHtmlRef.current = html;
    setCount(editor.textContent.length);
    update(draft => { if (html) draft.draft = html; else delete draft.draft; });
    editor.focus();
  }
  // SVG اولیه سه آیکون دارد. فقط ناحیه کلیک نامرئی به آن‌ها می‌دهیم.
  function existingToolbarIcon(svg) {
    const areas = [
      [0, clearDraft, 'حذف متن بازخورد'],
      [34, editDraft, 'ویرایش متن بازخورد'],
      [68, undoDraft, 'بازگردانی آخرین تغییر'],
    ];
    return patch(svg, {}, [
      ...React.Children.toArray(svg.props.children),
      ...areas.map(([x, handler, label]) =>
        <rect key={label} x={x} y="0" width="24" height="20" fill="transparent"
          role="button" tabIndex={0} aria-label={label} onClick={handler}
          onKeyDown={event => activate(event, handler)} />),
    ]);
  }
  function toggleDraftApproval() {
    setDraftApproved(approved => !approved);
  }
  function submit() {
    if (busyRef.current) return;
    const html = cleanHtml(editorRef.current.innerHTML), text = richText(html);
    if (!text) { editorRef.current.focus(); setError(true); setTimeout(() => setError(false), 1200); toast('لطفاً ابتدا متن بازخورد را بنویسید'); return; }
    if (editorRef.current.textContent.length > MAX) { toast('متن بازخورد نباید بیشتر از ' + toFa(MAX) + ' کاراکتر باشد'); return; }
    busyRef.current = true; setTimeout(() => { busyRef.current = false; }, 400);
    const item = { id: uid(), author: AUTHOR, html, text, ts: Date.now(), mentions: [...mentions], files: [...files], approved: draftApproved };
    if (reply) item.replyTo = { ...reply };
    update(draft => { draft.feedbacks.push(item); addLog(draft, 'بازخورد جدید ثبت شد: «' + brief(text) + '»'); delete draft.draft; });
    resetForm(); toast('بازخورد ثبت شد');
    setTimeout(() => [...document.querySelectorAll('.fb-new')].find(el => el.dataset.fbId === item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }
  function resetAll() {
    const before = state.feedbacks, logs = state.logs;
    const seed = seedRef.current;
    if (!seed) return;
    update(draft => { draft.feedbacks = [structuredClone(seed)]; addLog(draft, 'بازخوردها به حالت اولیه بازگشت'); });
    resetForm(false); setReply(replyFor(seed));
    toast('بازخوردها به حالت اولیه برگشت', 'بازگردانی', () => { update(draft => { draft.feedbacks = before; draft.logs = logs; }); setReply(null); });
  }
  function printFeedback(kind) {
    if (!state.feedbacks.length) { toast('بازخوردی برای ' + kind + ' وجود ندارد'); return; }
    const report = state.feedbacks.map(f => '<section><header><b>' + esc(f.author) + '</b><span> — ' + (f.approved ? 'تایید شده' : 'تایید نشده') + (f.ts ? ' — ' + shamsi(f.ts) : '') + '</span></header>' + (f.mentions?.length ? '<div class="m">منشن: ' + esc(f.mentions.join('، ')) + '</div>' : '') + (f.replyTo ? '<blockquote>' + esc(f.replyTo.author + ': ' + f.replyTo.text) + '</blockquote>' : '') + '<div>' + itemHtml(f) + '</div>' + (f.files?.length ? '<div class="m">پیوست: ' + esc(f.files.map(file => file.name).join('، ')) + '</div>' : '') + '</section>').join('');
    const frame = document.createElement('iframe'); frame.className = 'fb-print-frame'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1; document.body.appendChild(frame);
    const d = frame.contentWindow.document; d.open();
    d.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>بازخوردها</title><base href="' + esc(document.baseURI) + '"><style>@font-face{font-family:Vazirmatn;src:url(./fonts/Vazirmatn-NL-Regular.woff2)}body{font-family:Vazirmatn,Tahoma,sans-serif;margin:24px;color:#222;line-height:1.9}h1{font-size:20px;color:#36459B}section{border:1px solid #B2C6E3;border-radius:10px;padding:12px 16px;margin:0 0 14px;page-break-inside:avoid}header{margin-bottom:6px}.m{color:#666;font-size:12px}blockquote{margin:6px 0;padding:4px 10px;border-right:3px solid #36459B;background:#EEF2FA}img{max-width:100%;height:auto;border-radius:8px}</style></head><body><h1>گزارش بازخوردها</h1>' + report + '</body></html>'); d.close();
    setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1500); }, 300);
    update(draft => addLog(draft, 'خروجی ' + kind + ' از بازخوردها گرفته شد'));
    if (kind === 'PDF') toast('در پنجرهٔ چاپ، مقصد را «Save as PDF» انتخاب کنید');
  }
  function excel() {
    if (!state.feedbacks.length) { toast('بازخوردی برای خروجی وجود ندارد'); return; }
    const rows = [['ردیف', 'نویسنده', 'وضعیت', 'منشن‌ها', 'تاریخ ثبت', 'متن', 'فایل‌های پیوست'], ...state.feedbacks.map((f, i) => [toFa(i + 1), f.author, f.approved ? 'تایید شده' : 'تایید نشده', (f.mentions || []).join('، '), f.ts ? shamsi(f.ts) : '', f.text, (f.files || []).map(file => file.name).join('، ')])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'feedbacks.csv'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    update(draft => addLog(draft, 'خروجی اکسل از بازخوردها گرفته شد')); toast('فایل feedbacks.csv دانلود شد (با اکسل باز می‌شود)');
  }
  const requestFile = () => fileRef.current?.click();
  const selectedTags = mentions.map(name => {
    const person = persons.find(p => p.name === name); if (!person) return null;
    return patch(renderTree(templates.mentionTag, n => {
      if (hasClass(n, 'tb4-avatar') || hasClass(n, 'tb4-avatar-img')) return patch(person.avatar, { className: `${person.avatar.props.className} tb4-av-xs` });
      if (hasClass(n, 'tb4-name-mention')) return patch(n, {}, name);
      if (hasClass(n, 'tb4-tag-del')) return patch(n, { 'aria-label': 'حذف منشن', 'data-person': person.index, onClick: e => { e.preventDefault(); setMentions(list => list.filter(x => x !== name)); } });
      return n;
    }), { key: name });
  });
  let personIndex = 0, toolIndex = 0;
  const form = renderTree(templates.feedbackForm, node => {
    if (hasClass(node, 'toolbar2-name')) return patch(node, {}, reply?.author || '');
    if (hasClass(node, 'toolbar2-txt')) return patch(node, {}, reply?.text || '');
    if (hasClass(node, 'toolbar2-delete')) return patch(node, { role: 'button', tabIndex: 0, 'aria-label': 'حذف پاسخ', onClick: () => setReply(null), onKeyDown: e => activate(e, () => setReply(null)) });
    if (hasClass(node, 'icon-toolbar3')) return patch(node, {}, React.Children.toArray(node.props.children).map(child =>
      React.isValidElement(child) && child.type === 'svg' ? existingToolbarIcon(child) : child));
    if (hasClass(node, 'status-toolbar3')) return patch(node, {
      className: `status-toolbar3${draftApproved ? '' : ' status-unapproved'}`,
      role: 'button', tabIndex: 0, 'aria-label': 'تغییر وضعیت بازخورد',
      'aria-pressed': draftApproved, onClick: toggleDraftApproval,
      onKeyDown: e => activate(e, toggleDraftApproval),
    }, [<span className="circle-status" key="dot" />, <span key="label">{draftApproved ? 'تایید شده' : 'تایید نشده'}</span>]);
    if (hasClass(node, 'tb4-quote')) return patch(node, { style: { display: reply ? undefined : 'none' } });
    if (hasClass(node, 'tb4-pop-item')) {
      const person = persons[personIndex++]; if (!person) return node;
      return renderTree(node, n => hasClass(n, 'tb4-chk') ? patch(n, { defaultChecked: undefined, checked: mentions.includes(person.name), onChange: e => setMentions(list => e.target.checked ? persons.filter(p => list.includes(p.name) || p.name === person.name).map(p => p.name) : list.filter(name => name !== person.name)) }) : n);
    }
    if (hasClass(node, 'tb4-pop')) return patch(node, { className: `tb4-pop${popup ? '' : ' is-closed'}` });
    if (hasClass(node, 'tb4-btn')) {
      const index = toolIndex++;
      return patch(node, { title: TITLES[index], 'aria-label': TITLES[index], 'aria-pressed': index < 4 ? !!commands[index] : undefined, className: `${node.props.className}${commands[index] ? ' is-active' : ''}`, onMouseDown: e => e.preventDefault(), onClick: () => { if (index === 4) requestFile(); else { applyCommand(editorRef.current, COMMANDS[index]); editorInput(); } } });
    }
    if (hasClass(node, 'tb4-input')) return <div className="tb4-input tb4-rich" ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" dir="rtl" data-placeholder={node.props.placeholder || 'متن بازخورد را اینجا وارد کنید...'} aria-label="متن بازخورد" onInput={editorInput} onPaste={e => { pastePlain(e, editorRef.current); editorInput(); }} onDrop={e => { if (e.dataTransfer.files.length) e.preventDefault(); }} onBeforeInput={e => { if (/^insert/.test(e.nativeEvent.inputType || '') && e.nativeEvent.inputType !== 'insertFromPaste' && editorRef.current.textContent.length >= MAX && window.getSelection()?.isCollapsed) e.preventDefault(); }} onKeyUp={e => { if (e.key === '@') setPopup(true); }} onKeyDown={e => { enterQuote(e, editorRef.current); if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); } }} />;
    if (hasClass(node, 'tb4-editor')) return patch(node, { className: `tb4-editor${error ? ' fb-error' : ''}` }, [...React.Children.toArray(node.props.children), <div key="counter" className={`fb-counter${count > MAX * .9 ? ' is-over' : ''}`} aria-live="off">{toFa(count)} / {toFa(MAX)}</div>]);
    if (hasClass(node, 'tb4-tag-lbl')) return patch(node, { role: 'button', tabIndex: 0, title: 'انتخاب منشن', 'aria-expanded': popup, onClick: e => { e.stopPropagation(); setPopup(open => !open); }, onKeyDown: e => activate(e, () => setPopup(open => !open)) });
    if (hasClass(node, 'tb4-tag-box')) {
      const label = find(node, n => hasClass(n, 'tb4-tag-lbl'));
      return patch(node, {}, [label, ...(mentions.length ? selectedTags : [<span className="fb-no-tag" key="none">بدون منشن</span>])]);
    }
    if (hasClass(node, 'mention2-toolbar4')) return patch(node, { role: 'button', tabIndex: 0, style: { cursor: 'pointer' }, onClick: requestFile, onKeyDown: e => activate(e, requestFile) });
    if (node.type === 'form') return patch(node, { onSubmit: e => { e.preventDefault(); submit(); } });
    if (hasClass(node, 'toolbar4')) {
      const children = React.Children.toArray(node.props.children), editorIndex = children.findIndex(child => React.isValidElement(child) && hasClass(child, 'tb4-editor'));
      const fileList = <div className="fb-files" aria-live="polite" key="files">{files.map((file, i) => <span className="fb-file-chip" key={i}><span className="fb-file-name">{file.name}</span><span className="fb-file-size">{fmtSize(file.size)}</span><button type="button" className="fb-file-del" aria-label="حذف فایل" data-i={i} onClick={() => setFiles(list => list.filter((_, at) => at !== i))}>×</button></span>)}</div>;
      children.splice(editorIndex + 1, 0, fileList);
      children.push(<input key="input" ref={fileRef} type="file" multiple className="fb-file-input" tabIndex={-1} aria-hidden="true" onChange={e => { const next = [...files]; for (const f of e.target.files) { if (f.size > 10 * 1048576) { toast('فایل «' + f.name + '» بزرگ‌تر از ۱۰ مگابایت است'); continue; } if (next.length >= 5) { toast('حداکثر ۵ فایل قابل پیوست است'); break; } next.push({ name: f.name, size: f.size }); } setFiles(next); e.target.value = ''; }} />);
      return patch(node, {}, children);
    }
    if (hasClass(node, 'feedback-toolbar3')) return patch(node, { style: { display: tab === 0 ? undefined : 'none' } });
    return node;
  });
  let toolbarIndex = 0;
  const toolbar = renderTree(templates.feedbackToolbar, node => {
    if (node.type === 'button' && hasClass(node, 'add-feedback-btn')) return patch(node, { onClick: () => { setTab(0); editorRef.current.focus(); editorRef.current.closest('.tb4-editor').scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    if (hasClass(node, 'icon-btn')) { const index = toolbarIndex++; return patch(node, { onClick: [resetAll, () => printFeedback('چاپ'), () => printFeedback('PDF'), excel][index] }); }
    if (hasClass(node, 'feedback-toolbar')) return patch(node, { style: { display: tab === 0 ? undefined : 'none' } });
    return node;
  });
  const paneItems = tab === 1 ? (state.logs || []).map((log, i) => <li className="fb-pane-item" key={i}><span className="fb-pane-main">{log.text}</span><span className="fb-pane-meta" title={shamsi(log.ts)}>{log.user} · {timeAgo(log.ts)}</span></li>) : (state.feedbacks || []).flatMap(f => (f.files || []).map((file, i) => <li className="fb-pane-item" key={`${f.id}-${i}`}><span className="fb-pane-main"><span className="fb-file-name">{file.name}</span><span className="fb-file-size"> {fmtSize(file.size)}</span></span><span className="fb-pane-meta">{f.author}{f.ts ? ' · ' + timeAgo(f.ts) : ''}</span></li>));
  let tabIndex = 0;
  return renderTree(templates.activities, node => {
    if (hasClass(node, 'file-details1') && hasClass(node, 'flesh')) return patch(node, { className: `file-details1 flesh${collapsed ? ' is-collapsed' : ''}`, role: 'button', tabIndex: 0, 'aria-expanded': !collapsed, onClick: () => setCollapsed(value => !value), onKeyDown: e => activate(e, () => setCollapsed(value => !value)) });
    if (hasClass(node, 'tab-btn')) {
      const index = tabIndex++;
      return patch(node, { role: 'tab', className: `tab-btn${tab === index ? ' active' : ''}`, 'aria-selected': tab === index, tabIndex: tab === index ? 0 : -1, onClick: () => setTab(index), onKeyDown: e => { let next; if (e.key === 'ArrowLeft') next = (index + 1) % 3; else if (e.key === 'ArrowRight') next = (index + 2) % 3; if (next !== undefined) { e.preventDefault(); setTab(next); rootRef.current.querySelectorAll('.tab-btn')[next]?.focus(); } } });
    }
    if (hasClass(node, 'tabs-wrapper')) return patch(node, { role: 'tablist', style: { display: collapsed ? 'none' : undefined } });
    if (hasClass(node, 'tab-content')) return patch(node, { style: { display: collapsed ? 'none' : undefined } }, <>{toolbar}{(state.feedbacks || []).map(item => <Card key={item.id} item={item} persons={persons} onLayout={requestLayout} visible={tab === 0} onReply={f => { setReply(replyFor(f)); editorRef.current.focus(); editorRef.current.closest('.tb4-editor').scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />)}{form}<div className="fb-pane" role="tabpanel" style={{ display: tab ? undefined : 'none' }}><ul className="fb-pane-list">{paneItems.length ? paneItems : <li className="fb-pane-empty">{tab === 1 ? 'هنوز فعالیتی ثبت نشده است' : 'هنوز فایلی پیوست نشده است'}</li>}</ul></div></>);
    if (hasClass(node, 'activities-top')) return patch(node, { ref: rootRef });
    return node;
  });
}
