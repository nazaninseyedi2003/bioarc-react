import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import avatar from '../img/avatar.png';
import { USERS } from '../lib/utils.js';

/* ---------- پاپ‌آور (فقط یکی در هر لحظه باز است) ----------
   مثل نسخه‌ی jQuery: به <body> اضافه می‌شود و با مختصات مطلقِ زیر دکمه قرار می‌گیرد. */
export default function Popover({ anchor, onClose, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const position = () => {
    const pop = ref.current;
    if (!pop || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const offLeft = rect.left + window.pageXOffset;
    const offTop = rect.top + window.pageYOffset;
    const aw = rect.width;
    const ah = rect.height;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const winW = document.documentElement.clientWidth;
    const winH = window.innerHeight;
    const scrollTop = window.pageYOffset;
    const scrollLeft = window.pageXOffset;

    let left = offLeft + aw / 2 - pw / 2;
    const maxLeft = scrollLeft + winW - pw - 8;
    left = Math.max(8, Math.min(left, maxLeft));

    let top = offTop + ah + 8;
    let above = false;
    if (top + ph > scrollTop + winH && offTop - ph - 8 > scrollTop) {
      top = offTop - ph - 8;
      above = true;
    }
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    pop.style.setProperty('--arrow-x', offLeft + aw / 2 - left + 'px');
    pop.classList.toggle('above', above);
  };

  useLayoutEffect(position);

  useEffect(() => {
    // اندازه‌ی پاپ‌آور با تغییر محتوا (مثلاً نتیجه‌ی جستجو) عوض می‌شود
    let ro = null;
    if (window.ResizeObserver && ref.current) {
      ro = new ResizeObserver(position);
      ro.observe(ref.current);
    }
    // بستن با کلیک بیرون / Esc / تغییر اندازه
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchor && anchor.contains(e.target)) return;
      closeRef.current(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current(true);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', position);
    return () => {
      if (ro) ro.disconnect();
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', position);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  return createPortal(
    <div className="popover" role="dialog" ref={ref}>
      {children}
    </div>,
    document.body
  );
}

/* ---------- فرم افزودن پیوند ---------- */
export function LinkForm({ onSubmit, onCancel }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  return (
    <form
      className="pop-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const err = onSubmit(value);
        if (err) setError(err);
      }}
    >
      <p className="pop-title">افزودن پیوند</p>
      <input
        ref={inputRef}
        type="url"
        dir="ltr"
        autoComplete="off"
        placeholder="https://example.com"
        aria-label="افزودن پیوند"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className="pop-error" role="alert">{error}</p>
      <div className="pop-actions">
        <button type="submit" className="pop-btn primary">افزودن</button>
        <button type="button" className="pop-btn" onClick={onCancel}>انصراف</button>
      </div>
    </form>
  );
}

/* ---------- لیست تراز متن ---------- */
const ALIGN_OPTIONS = [
  ['justifyRight', 'راست‌چین'],
  ['justifyCenter', 'وسط‌چین'],
  ['justifyLeft', 'چپ‌چین'],
  ['justifyFull', 'تراز دوطرفه'],
];

export function AlignList({ onPick }) {
  return (
    <div style={{ minWidth: 140 }}>
      <ul className="pop-list">
        {ALIGN_OPTIONS.map(([cmd, label]) => (
          <li key={cmd}>
            <button
              type="button"
              data-align={cmd}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(cmd)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- انتخاب منشن ---------- */
export function MentionPicker({ taken, onPick }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  const q = query.trim();
  const found = USERS.filter((u) => taken.indexOf(u.id) === -1 && u.name.indexOf(q) > -1);

  return (
    <div>
      <p className="pop-title">افزودن منشن</p>
      <input
        ref={inputRef}
        type="search"
        placeholder="جستجوی نام…"
        aria-label="جستجوی کاربر"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="pop-list">
        {!found.length && <li className="pop-empty">کاربری پیدا نشد.</li>}
        {found.map((u) => (
          <li key={u.id}>
            <button type="button" data-id={u.id} onClick={() => onPick(u)}>
              <img src={avatar} alt="" />
              <span>{u.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- راهنمای QR ---------- */
export function QrHelp({ onClose }) {
  return (
    <div>
      <p className="pop-title">بارگذاری با موبایل</p>
      <p>کد QR را با دوربین گوشی اسکن کنید و سند را از موبایل بفرستید.</p>
      <div className="pop-actions">
        <button type="button" className="pop-btn" onClick={() => onClose(true)}>متوجه شدم</button>
      </div>
    </div>
  );
}

/* ---------- تأیید بستن فرم ---------- */
export function CloseConfirm({ onConfirm, onCancel }) {
  return (
    <div>
      <p className="pop-title">بستن فرم؟</p>
      <p>اطلاعات واردشده حفظ می‌شود و با «نمایش دوباره فرم» برمی‌گردد.</p>
      <div className="pop-actions">
        <button type="button" className="pop-btn primary" data-confirm autoFocus onClick={onConfirm}>
          بستن
        </button>
        <button type="button" className="pop-btn" onClick={onCancel}>انصراف</button>
      </div>
    </div>
  );
}
