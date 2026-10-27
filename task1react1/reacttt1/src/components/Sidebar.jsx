import React, { Children, isValidElement, useEffect, useRef, useState } from 'react';
import { templates } from '../templates/original';
import { renderTree, hasClass, patch } from '../lib';
import { useApp, toFa, toInt, uid, norm, timeAgo, shamsi } from '../state';

const SUGGESTIONS = ['فشار خون', 'دیابت نوع ۲', 'نارسایی قلبی', 'آسم', 'کم‌خونی', 'میگرن', 'اختلال تیروئید', 'آرتریت'];

function textOf(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (!isValidElement(value) || value.type === 'svg') return '';
  return textOf(value.props.children);
}

function findElement(tree, predicate) {
  let found = null;
  renderTree(tree, (element) => {
    if (!found && predicate(element)) found = element;
    return element;
  });
  return found;
}

function section(state, key) {
  const value = state[key] || {};
  return { added: Array.isArray(value.added) ? value.added : [], removed: Array.isArray(value.removed) ? value.removed : [] };
}

function visibleAdded(state, key) {
  const value = section(state, key);
  return value.added.filter((item) => !value.removed.includes(item.id));
}

function visibleSeeds(state, key, seeds, attribute) {
  const removed = section(state, key).removed;
  return seeds.filter((element) => !removed.includes(element.props[attribute]));
}

function useRemove() {
  const { update, toast } = useApp();
  return (key, id, message) => {
    update((draft) => {
      draft[key] ||= { added: [], removed: [] };
      if (!draft[key].removed.includes(id)) draft[key].removed.push(id);
    });
    toast(message, 'بازگردانی', () => {
      update((draft) => {
        draft[key].removed = draft[key].removed.filter((removedId) => removedId !== id);
      });
    });
  };
}

function InlineForm({ open, placeholder, maxLength, onSubmit, onClose, keepOpen = false }) {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setError('');
  }, [open]);
  function submit() {
    const message = onSubmit(norm(value));
    if (message) {
      setError(message);
      inputRef.current?.focus();
      return;
    }
    setValue('');
    setError('');
    if (keepOpen) inputRef.current?.focus();
    else onClose();
  }
  return <div className="sb-inline-form" style={{ display: open ? undefined : 'none' }}>
    <div className="sb-inline-row">
      <input ref={inputRef} type="text" className="sb-inline-input" autoComplete="off" placeholder={placeholder} aria-label={placeholder} maxLength={maxLength} value={value}
        onChange={(event) => { setValue(event.target.value); setError(''); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
          else if (event.key === 'Escape') onClose();
        }} />
      <button type="button" className="sb-inline-btn" onClick={submit}>افزودن</button>
    </div>
    <div className="sb-inline-error" role="alert">{error}</div>
  </div>;
}

function TagCard({ template }) {
  const { state, update, toast } = useApp();
  const remove = useRemove();
  const key = template.props['data-tag-card'];
  const isDiagnosis = key === 't1';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const stored = section(state, key);
  const seedContainer = findElement(template, (element) => hasClass(element, 'sidebar1-container') || hasClass(element, 'sidebar2-container'));
  const seedTags = Children.toArray(seedContainer?.props.children).filter((child) => isValidElement(child) && child.props['data-tag-id']);
  const visible = seedTags.filter((tag) => !stored.removed.includes(tag.props['data-tag-id']));
  const added = visibleAdded(state, key);
  const names = [...visible.map((tag) => norm(textOf(tag))), ...added.map((tag) => norm(tag.text))];
  const exists = (name) => names.some((item) => item.toLowerCase() === name.toLowerCase());
  function add(text, ai = false) {
    const tag = { id: uid(), text, ai, tone: visible.length + added.length };
    update((draft) => { draft[key].added.push(tag); });
  }
  function removeButton(id, name) {
    return <button key="remove" type="button" className="tag-remove" aria-label="حذف برچسب" title="حذف"
      onClick={(event) => { event.stopPropagation(); remove(key, id, `برچسب «${name}» حذف شد`); }}>×</button>;
  }
  function customTag(tag) {
    return <span key={tag.id} className={isDiagnosis ? 'tagsidebar1 tagsidebar1-custom' : `title-custom-sidebar2 tone-${tag.tone % 4}`} data-tag-id={tag.id}>
      {tag.text}{tag.ai && templates.sparkle}{removeButton(tag.id, tag.text)}
    </span>;
  }
  function suggest() {
    if (loading) return;
    const name = SUGGESTIONS.find((suggestion) => !exists(suggestion));
    if (!name) { toast('پیشنهاد جدیدی وجود ندارد.'); return; }
    setLoading(true);
    timer.current = setTimeout(() => {
      setLoading(false);
      add(name, true);
      toast(`برچسب هوشمند «${name}» اضافه شد`);
    }, 700);
  }
  const form = <InlineForm key="form" open={open} placeholder={isDiagnosis ? 'کد یا نام تشخیص جدید…' : 'برچسب آموزشی جدید…'} maxLength={24} keepOpen onClose={() => setOpen(false)}
    onSubmit={(value) => {
      if (!value) return 'نام برچسب را وارد کنید.';
      if (value.length > 24) return 'حداکثر ۲۴ کاراکتر مجاز است.';
      if (exists(value)) return 'این برچسب قبلاً اضافه شده است.';
      add(value);
    }} />;
  return renderTree(template, (element) => {
    if (hasClass(element, 'sidebar1-btn')) return patch(element, { 'aria-pressed': String(open), onClick: () => setOpen((value) => !value) });
    if (hasClass(element, 'sidebar1-container') || hasClass(element, 'sidebar2-container')) {
      let inserted = false;
      const children = Children.toArray(element.props.children).flatMap((child) => {
        if (!isValidElement(child)) return [child];
        const id = child.props['data-tag-id'];
        if (id) {
          if (stored.removed.includes(id)) return [];
          return [patch(child, {}, [...Children.toArray(child.props.children), removeButton(id, norm(textOf(child)))])];
        }
        if (hasClass(child, 'smart-tag')) {
          inserted = true;
          return [...added.map(customTag), patch(child, { className: `${child.props.className}${loading ? ' is-loading' : ''}`, 'aria-busy': loading ? 'true' : undefined, onClick: suggest })];
        }
        return [child];
      });
      if (!inserted) children.push(...added.map(customTag));
      return <React.Fragment key={element.key || 'tags'}>{patch(element, {}, children)}{form}</React.Fragment>;
    }
    if (hasClass(element, 'tag-card')) return patch(element, { className: `${element.props.className}${open ? ' is-editing' : ''}` });
    return element;
  });
}

function Thumb({ role, active }) {
  const icon = active ? <>
    <path d="M7 11l4-9a3 3 0 0 1 3 3v4h5.66a2 2 0 0 1 2 2.3l-1.38 9a2 2 0 0 1-2 1.7H7z" fill="currentColor" stroke="none" />
    <path d="M2 13a2 2 0 0 1 2-2h1.5v11H4a2 2 0 0 1-2-2z" fill="currentColor" stroke="none" />
  </> : <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
  return <svg className="thumb-ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{role === 'dislike' ? <g transform="rotate(180 12 12)">{icon}</g> : icon}</svg>;
}

function articleCommentIcon() {
  const badge = findElement(templates.articles[0], (element) => element.props?.['data-role'] === 'comment');
  return findElement(badge, (element) => element.type === 'svg');
}

function Article({ template, item, commentDelta }) {
  const { state, update } = useApp();
  const remove = useRemove();
  const [tip, setTip] = useState(false);
  const [bump, setBump] = useState(null);
  const bumpTimer = useRef(null);
  useEffect(() => () => clearTimeout(bumpTimer.current), []);
  const id = item?.id || template.props['data-article-id'];
  const vote = state.votes?.[id];
  function clickStat(role) {
    setBump(role);
    clearTimeout(bumpTimer.current);
    bumpTimer.current = setTimeout(() => setBump(null), 220);
    update((draft) => {
      if (role === 'comment') {
        if (draft.cmt[id]) delete draft.cmt[id];
        else draft.cmt[id] = true;
      } else if (draft.votes[id] === role) delete draft.votes[id];
      else draft.votes[id] = role;
    });
    if (role === 'comment') {
      const input = document.querySelector('.part4-sidebar3-input');
      input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      input?.focus();
    }
  }
  const addedTemplate = item ? <div className="part1-sidebar3 article-item" data-kind="person" data-user="1" data-article-id={id}>
    <div className="name-tip" role="tooltip"><strong>شما</strong><span>تاریخ ثبت: {shamsi(item.ts)}</span></div>
    <div className="title-row">{templates.personArticle}<span className="text-sidebar3">{item.title}</span></div>
    <div className="action-row"><a href="#" className="view-article">مشاهده مقاله</a><span className="del-sidebar3" role="button" tabIndex={0} aria-label="حذف مقاله" title="حذف">{templates.deleteIcon}</span></div>
    <div className="stats-row">{['like', 'dislike', 'comment'].map((role) => <div key={role} className={`stat-badge stat-${role}`} data-role={role} role="button" tabIndex={0} aria-label={role === 'like' ? 'پسندیدن' : role === 'dislike' ? 'نپسندیدن' : 'نظرات'}>
      <span>۰</span>{role === 'comment' ? articleCommentIcon() : <Thumb role={role} active={false} />}
    </div>)}</div>
  </div> : template;
  return renderTree(addedTemplate, (element) => {
    if (hasClass(element, 'stat-badge')) {
      const role = element.props['data-role'];
      const number = Children.toArray(element.props.children).find((child) => isValidElement(child) && child.type === 'span');
      const base = toInt(textOf(number));
      const active = role === 'comment' ? !!state.cmt?.[id] : vote === role;
      const count = role === 'comment' ? Math.max(0, base + commentDelta + (active ? 1 : 0)) : base + (active ? 1 : 0);
      let hasIcon = false;
      const children = Children.toArray(element.props.children).map((child) => {
        if (isValidElement(child) && child.type === 'span') return patch(child, {}, toFa(count));
        if (isValidElement(child) && (child.type === 'svg' || child.type === Thumb)) {
          hasIcon = true;
          return role === 'comment' ? child : <Thumb key="thumb" role={role} active={active} />;
        }
        return child;
      });
      if (!hasIcon && role !== 'comment') children.push(<Thumb key="thumb" role={role} active={active} />);
      return patch(element, { className: `${element.props.className}${active ? ' active' : ''}${bump === role ? ' sb-bump' : ''}`, 'aria-pressed': String(active), onClick: () => clickStat(role) }, children);
    }
    if (hasClass(element, 'name-tip')) return patch(element, { style: { ...element.props.style, display: tip ? 'block' : 'none' } });
    if (hasClass(element, 'ai-sidebar3') && hasClass(element, 'person')) return patch(element, { tabIndex: 0, onMouseEnter: () => setTip(true), onMouseLeave: () => setTip(false), onFocus: () => setTip(true), onBlur: () => setTip(false) });
    if (hasClass(element, 'del-sidebar3')) return patch(element, { onClick: () => remove('articles', id, 'مقاله حذف شد') });
    return element;
  });
}

function Comments({ template }) {
  const { state, update } = useApp();
  const remove = useRemove();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [, setTick] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const invalidTimer = useRef(null);
  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 60000);
    return () => { clearInterval(interval); clearTimeout(invalidTimer.current); };
  }, []);
  const seeds = visibleSeeds(state, 'comments', templates.comments, 'data-comment-id');
  const added = visibleAdded(state, 'comments');
  function send() {
    const text = norm(value);
    if (!text) {
      setInvalid(true);
      input.current?.focus();
      clearTimeout(invalidTimer.current);
      invalidTimer.current = setTimeout(() => setInvalid(false), 600);
      return;
    }
    const comment = { id: uid(), username: 'شما', text, ts: Date.now(), avatar: section(state, 'comments').added.length % 2 ? 'part4-sidebar3-avatar-peach' : 'part4-sidebar3-avatar-green' };
    update((draft) => { draft.comments.added.unshift(comment); });
    setValue('');
    if (list.current) list.current.scrollTop = 0;
    input.current?.focus();
  }
  function commentNode(item) {
    return <div className="part4-sidebar3-item" data-comment-id={item.id} key={item.id}>
      <div className="part4-sidebar3-header">
        <div className="part4-sidebar3-user"><div className={`part4-sidebar3-avatar ${item.avatar}`}>{item.username.charAt(0)}</div><span className="part4-sidebar3-username">{item.username}</span></div>
        <button className="part4-sidebar3-delete" type="button" aria-label="حذف نظر" title="حذف" onClick={() => remove('comments', item.id, 'نظر حذف شد')}>{templates.deleteIcon}</button>
      </div>
      <p className="part4-sidebar3-text">{item.text}</p>
      <div className="part4-sidebar3-time" data-ts={item.ts}>{timeAgo(item.ts)}</div>
    </div>;
  }
  function seedNode(seed) {
    const id = seed.props['data-comment-id'];
    return <React.Fragment key={id}>{renderTree(seed, (element) => hasClass(element, 'part4-sidebar3-delete') ? patch(element, { onClick: () => remove('comments', id, 'نظر حذف شد') }) : element)}</React.Fragment>;
  }
  return renderTree(template, (element) => {
    if (hasClass(element, 'part4-sidebar3-list')) return patch(element, { ref: list }, [...added.map(commentNode), ...seeds.map(seedNode), <div key="empty" className="sb-empty" style={{ display: added.length + seeds.length ? 'none' : undefined }}>هنوز نظری ثبت نشده است.</div>]);
    if (hasClass(element, 'part4-sidebar3-input')) return patch(element, { ref: input, value, className: `${element.props.className}${invalid ? ' is-invalid' : ''}`, onChange: (event) => setValue(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } } });
    if (hasClass(element, 'part4-sidebar3-send-btn')) return patch(element, { onClick: send });
    return element;
  });
}

function ArticlesCard({ template }) {
  const { state, update, toast } = useApp();
  const [open, setOpen] = useState(false);
  const seeds = visibleSeeds(state, 'articles', templates.articles, 'data-article-id');
  const added = visibleAdded(state, 'articles');
  const commentDelta = visibleSeeds(state, 'comments', templates.comments, 'data-comment-id').length + visibleAdded(state, 'comments').length - templates.comments.length;
  const form = <InlineForm key="article-form" open={open} placeholder="عنوان مقالهٔ جدید…" maxLength={120} onClose={() => setOpen(false)} onSubmit={(title) => {
    if (!title) return 'عنوان مقاله را وارد کنید.';
    if (title.length < 3) return 'عنوان باید حداقل ۳ کاراکتر باشد.';
    const article = { id: uid(), title, ts: Date.now() };
    update((draft) => { draft.articles.added.unshift(article); });
    toast('مقاله اضافه شد');
  }} />;
  return renderTree(template, (element) => {
    if (hasClass(element, 'add-article-btn')) return patch(element, { 'aria-expanded': String(open), onClick: () => setOpen((value) => !value) });
    if (hasClass(element, 'sidebar3-header')) return <React.Fragment key="article-header">{element}{form}</React.Fragment>;
    if (hasClass(element, 'article-list')) return <React.Fragment key="article-list">{patch(element, {}, [...added.map((item) => <Article key={item.id} item={item} commentDelta={commentDelta} />), ...seeds.map((seed) => <Article key={seed.props['data-article-id']} template={seed} commentDelta={commentDelta} />)])}<div className="sb-empty" style={{ display: added.length + seeds.length ? 'none' : undefined }}>هنوز مقاله‌ای اضافه نشده است.</div></React.Fragment>;
    if (hasClass(element, 'part4-sidebar3')) return <Comments key="comments" template={element} />;
    return element;
  });
}

function ExamsCard({ template }) {
  const { state, update, toast } = useApp();
  const remove = useRemove();
  const [open, setOpen] = useState(false);
  const seeds = visibleSeeds(state, 'exams', templates.exams, 'data-exam-id');
  const added = visibleAdded(state, 'exams');
  const form = <InlineForm key="exam-form" open={open} placeholder="عنوان آزمون جدید…" maxLength={60} onClose={() => setOpen(false)} onSubmit={(title) => {
    if (!title) return 'عنوان آزمون را وارد کنید.';
    if (title.length < 3) return 'عنوان باید حداقل ۳ کاراکتر باشد.';
    update((draft) => { draft.exams.added.push({ id: uid(), title }); });
    toast('آزمون اضافه شد');
  }} />;
  function seedExam(seed) {
    const id = seed.props['data-exam-id'];
    return <React.Fragment key={id}>{renderTree(seed, (element) => hasClass(element, 'exam-del') ? patch(element, { onClick: () => remove('exams', id, 'آزمون حذف شد') }) : element)}</React.Fragment>;
  }
  function addedExam(item) {
    return <div key={item.id} className="sidebar4-main exam-item" data-kind="person" data-exam-id={item.id}>
      <span className="icon-sidebar3">{templates.personExam} {item.title}</span>
      <div><a href="#" className="view-article">مشاهده آزمون</a><span className="del-sidebar3 exam-del" role="button" tabIndex={0} aria-label="حذف آزمون" title="حذف" onClick={() => remove('exams', item.id, 'آزمون حذف شد')}>{templates.deleteIcon}</span></div>
    </div>;
  }
  return renderTree(template, (element) => {
    if (hasClass(element, 'add-exam-btn')) return patch(element, { 'aria-expanded': String(open), onClick: () => setOpen((value) => !value) });
    if (hasClass(element, 'sidebar3-header')) return <React.Fragment key="exam-header">{element}{form}</React.Fragment>;
    if (hasClass(element, 'exam-list')) return <React.Fragment key="exam-list">{patch(element, {}, [...seeds.map(seedExam), ...added.map(addedExam)])}<div className="sb-empty" style={{ display: seeds.length + added.length ? 'none' : undefined }}>هنوز آزمونی ساخته نشده است.</div></React.Fragment>;
    return element;
  });
}

export default function Sidebar() {
  return renderTree(templates.sidebar, (element) => {
    if (hasClass(element, 'tag-card')) return <TagCard key={element.props['data-tag-card']} template={element} />;
    if (element.props.id === 'relatedArticles') return <ArticlesCard key="articles" template={element} />;
    if (hasClass(element, 'sidebar4')) return <ExamsCard key="exams" template={element} />;
    if (hasClass(element, 'sidebar')) return patch(element, {
      onClick: (event) => { if (event.target.closest('a[href="#"]')) event.preventDefault(); },
      onKeyDown: (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.getAttribute('role') === 'button') {
          event.preventDefault();
          event.target.click();
        }
      },
    });
    return element;
  });
}
