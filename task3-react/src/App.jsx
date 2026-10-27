import { useCallback, useEffect, useRef, useState } from 'react';
import avatar from './img/avatar.png';
import {
  CloseIcon, UnderlineIcon, QuoteIcon, ItalicIcon, BoldIcon, LinkIcon, AlignIcon,
  ChevronIcon, RemoveMentionIcon, FileIcon, SendIcon, QrIcon, DropIcon, CameraIcon,
} from './components/icons.jsx';
import Popover, {
  LinkForm, AlignList, MentionPicker, QrHelp, CloseConfirm,
} from './components/Popover.jsx';
import Toast from './components/Toast.jsx';
import History from './components/History.jsx';
import { LS_KEY, dbPut, dbGet, dbAll, dbDel, dbClear } from './lib/db.js';
import {
  MAX_FILE_SIZE, ALLOWED_EXT, USERS, formatSize, normalizeUrl, sanitizeHtml,
} from './lib/utils.js';

/* =========================================================
   بایوآرک — صفحه‌ی ثبت بازخورد (نسخه‌ی React)
   بخش‌ها: ۱) پیش‌نویس  ۲) پاپ‌آور  ۳) ادیتور  ۴) منشن
           ۵) فایل/سند  ۶) تب‌ها و ضبط صدا  ۷) ثبت و بستن  ۸) تاریخچه
========================================================= */

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch (err) {
    return null;
  }
}

const pad = (n) => (n < 10 ? '0' : '') + n;
const prevent = (e) => e.preventDefault();
// دسترسی‌پذیری: Enter و Space برای المان‌های role=button
const onKeyActivate = (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.currentTarget.click();
  }
};

export default function App() {
  const [initial] = useState(loadDraft);

  /* ---------- state ---------- */
  const [tab, setTab_] = useState(initial && initial.tab === 'voice' ? 'voice' : 'text');
  const [uploadOpen, setUploadOpen] = useState(!(initial && initial.uploadOpen === false));
  const [closed, setClosed] = useState(!!(initial && initial.closed));
  const [layoutHidden, setLayoutHidden] = useState(!!(initial && initial.closed));
  const [mentions, setMentions] = useState(() => {
    if (initial && Array.isArray(initial.mentions)) {
      const out = [];
      initial.mentions.forEach((id) => {
        id = Number(id);
        if (USERS.some((u) => u.id === id) && out.indexOf(id) === -1) out.push(id);
      });
      return out;
    }
    return [1];
  });
  const [removing, setRemoving] = useState([]);
  const [fresh, setFresh] = useState([]);
  const [tools, setTools] = useState({ underline: false, bold: false, italic: false, quote: false });
  const [popover, setPopover] = useState(null); // { key, anchor }
  const [toast, setToast] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recLabel, setRecLabel] = useState('شروع ضبط');
  const [timerText, setTimerText] = useState('00:00');
  const [recUrl, setRecUrl] = useState(null);
  const [history, setHistory] = useState([]);

  /* ---------- refs ---------- */
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const savedRange = useRef(null);
  const saveTimer = useRef(null);
  const restoring = useRef(true); // تا پایان بازیابی، چیزی ذخیره نمی‌شود
  const nextId = useRef((initial && initial.nextId) || 1);
  const attachmentsRef = useRef([]);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recBlobRef = useRef(null);
  const recUrlRef = useRef(null);
  const timerIdRef = useRef(null);
  const startTsRef = useRef(0);
  const timerTextRef = useRef('00:00');
  const historyUrls = useRef([]);

  const mentionIds = mentions.filter((id) => removing.indexOf(id) === -1);

  /* =========================================================
     ۱) پیش‌نویس ماندگار (localStorage) + توست
  ========================================================= */
  const live = useRef({});
  live.current = { tab, uploadOpen, closed, mentions: mentionIds };

  const showToast = useCallback((msg, isError) => {
    setToast({ id: Date.now() + Math.random(), msg, isError: !!isError });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);
  const dbFail = useCallback(
    () => showToast('ذخیره‌سازی در مرورگر ممکن نشد؛ ممکن است بعد از رفرش از بین برود.', true),
    [showToast]
  );

  const saveDraft = useCallback(() => {
    if (restoring.current) return;
    const s = live.current;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          html: editorRef.current ? editorRef.current.innerHTML : '',
          mentions: s.mentions,
          tab: s.tab,
          uploadOpen: s.uploadOpen,
          closed: s.closed,
          nextId: nextId.current,
        })
      );
    } catch (err) {
      /* حافظه پر است یا غیرفعال */
    }
  }, []);

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDraft, 250);
  }, [saveDraft]);

  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      saveDraft();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [saveDraft]);

  // هر تغییر در وضعیت‌ها => ذخیره‌ی پیش‌نویس
  useEffect(() => {
    scheduleSave();
  }, [tab, uploadOpen, closed, mentions, removing, attachments, scheduleSave]);

  /* =========================================================
     ۲) پاپ‌آور
  ========================================================= */
  const closePopover = useCallback(
    (returnFocus) => {
      if (!popover) return;
      const anchor = popover.anchor;
      setPopover(null);
      if (returnFocus && anchor) anchor.focus();
    },
    [popover]
  );

  const togglePopover = (key, anchor) => {
    // کلیک دوباره روی همان دکمه = بستن
    if (popover && popover.anchor === anchor) {
      closePopover();
      return;
    }
    setPopover({ key, anchor });
  };

  const expanded = (key) => !!popover && popover.key === key;

  /* =========================================================
     ۳) ادیتور و نوار ابزار
  ========================================================= */
  const saveRange = useCallback(() => {
    const ed = editorRef.current;
    const sel = window.getSelection();
    if (ed && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (ed.contains(r.commonAncestorContainer)) savedRange.current = r.cloneRange();
    }
  }, []);

  const restoreRange = () => {
    editorRef.current.focus();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const updateToolState = useCallback(() => {
    const ed = editorRef.current;
    const next = { underline: false, bold: false, italic: false, quote: false };
    if (ed && ed.contains(window.getSelection().anchorNode)) {
      try {
        next.underline = document.queryCommandState('underline');
        next.italic = document.queryCommandState('italic');
        next.bold = document.queryCommandState('bold');
        next.quote = String(document.queryCommandValue('formatBlock')).toLowerCase() === 'blockquote';
      } catch (err) {
        /* مرورگر پشتیبانی نمی‌کند */
      }
    }
    setTools((prev) =>
      prev.underline === next.underline && prev.bold === next.bold &&
      prev.italic === next.italic && prev.quote === next.quote
        ? prev
        : next
    );
  }, []);

  useEffect(() => {
    const onSel = () => {
      saveRange();
      updateToolState();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [saveRange, updateToolState]);

  // پاک‌کردن باقیمانده‌ی <br> وقتی ادیتور خالی می‌شود (برای نمایش placeholder)
  const handleInput = () => {
    const ed = editorRef.current;
    const html = ed.innerHTML;
    if (html === '<br>' || html === '') ed.innerHTML = '';
    scheduleSave();
  };

  // چسباندن فقط به‌صورت متن ساده
  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
  };

  const exec = (cmd, value) => {
    restoreRange();
    document.execCommand(cmd, false, value || null);
    handleInput();
    saveRange();
    updateToolState();
  };

  const onQuote = () => {
    const isQuote = String(document.queryCommandValue('formatBlock')).toLowerCase() === 'blockquote';
    exec('formatBlock', isQuote ? 'div' : 'blockquote');
  };

  const submitLink = (value) => {
    const url = normalizeUrl(value);
    if (!url) return 'نشانی واردشده معتبر نیست.';
    restoreRange();
    const sel = window.getSelection();
    if (sel.isCollapsed) {
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.textContent = url;
      const wrap = document.createElement('div');
      wrap.appendChild(a);
      document.execCommand('insertHTML', false, wrap.innerHTML);
    } else {
      document.execCommand('createLink', false, url);
    }
    editorRef.current.querySelectorAll('a').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    handleInput();
    closePopover();
    return null;
  };

  const toolCls = (cmd) => 'tool-btn' + (tools[cmd] ? ' active' : '');

  /* =========================================================
     ۴) منشن
  ========================================================= */
  const addMention = (user) => {
    if (mentions.indexOf(user.id) > -1) return;
    setMentions((prev) => [...prev, user.id]);
    setFresh((prev) => [...prev, user.id]);
  };

  const removeMention = (id) => {
    setRemoving((prev) => [...prev, id]);
    setTimeout(() => {
      setMentions((prev) => prev.filter((x) => x !== id));
      setRemoving((prev) => prev.filter((x) => x !== id));
      setFresh((prev) => prev.filter((x) => x !== id));
    }, 150);
  };

  /* =========================================================
     ۵) فایل / سند
  ========================================================= */
  const commitAttachments = (list) => {
    attachmentsRef.current = list;
    setAttachments(list);
  };

  const addFiles = (fileList) => {
    const list = attachmentsRef.current.slice();
    Array.from(fileList).forEach((f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (ALLOWED_EXT.indexOf(ext) === -1) {
        showToast('«' + f.name + '»: فرمت پشتیبانی نمی‌شود.', true);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        showToast('«' + f.name + '»: حجم فایل بیش از ۱۰ مگابایت است.', true);
        return;
      }
      if (list.some((a) => a.file.name === f.name && a.file.size === f.size)) {
        showToast('«' + f.name + '» قبلاً اضافه شده است.', true);
        return;
      }
      const att = {
        id: nextId.current++,
        file: f,
        name: f.name,
        preview: /^image\//.test(f.type) ? URL.createObjectURL(f) : null,
      };
      list.push(att);
      dbPut('files', { id: att.id, name: f.name, type: f.type, size: f.size, blob: f }).catch(dbFail);
    });
    commitAttachments(list);
    scheduleSave();
  };

  const removeAttachment = (id) => {
    const list = attachmentsRef.current.filter((a) => {
      if (a.id === id && a.preview) URL.revokeObjectURL(a.preview);
      return a.id !== id;
    });
    dbDel('files', id).catch(dbFail);
    commitAttachments(list);
    scheduleSave();
  };

  const toggleUpload = () => setUploadOpen((o) => !o);

  const onPickFiles = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  // جلوگیری از باز شدن فایل در مرورگر وقتی بیرون از ناحیه رها می‌شود
  useEffect(() => {
    const stop = (e) => e.preventDefault();
    document.addEventListener('dragover', stop);
    document.addEventListener('drop', stop);
    return () => {
      document.removeEventListener('dragover', stop);
      document.removeEventListener('drop', stop);
    };
  }, []);

  /* =========================================================
     ۶) تب‌ها و ضبط صدا
  ========================================================= */
  const tick = () => {
    const s = Math.floor((Date.now() - startTsRef.current) / 1000);
    const text = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    timerTextRef.current = text;
    setTimerText(text);
  };

  const clearRecording = () => {
    if (recUrlRef.current) URL.revokeObjectURL(recUrlRef.current);
    recBlobRef.current = null;
    recUrlRef.current = null;
    setRecUrl(null);
    timerTextRef.current = '00:00';
    setTimerText('00:00');
    dbDel('kv', 'recording').catch(() => { /* مهم نیست */ });
  };

  const stopRecording = () => {
    clearInterval(timerIdRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') {
      tick();
      rec.stop();
    }
    setRecording(false);
    setRecLabel('ضبط مجدد');
  };

  const startRecording = () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      showToast('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.', true);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        clearRecording();
        streamRef.current = s;
        chunksRef.current = [];
        const rec = new MediaRecorder(s);
        recorderRef.current = rec;
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          streamRef.current.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          recBlobRef.current = blob;
          recUrlRef.current = url;
          setRecUrl(url);
          dbPut('kv', { blob, timer: timerTextRef.current }, 'recording').catch(dbFail);
        };
        rec.start();
        startTsRef.current = Date.now();
        timerTextRef.current = '00:00';
        setTimerText('00:00');
        timerIdRef.current = setInterval(tick, 250);
        setRecording(true);
        setRecLabel('توقف ضبط');
      })
      .catch(() => {
        showToast('دسترسی به میکروفون ممکن نشد.', true);
      });
  };

  const onRecClick = () => {
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') stopRecording();
    else startRecording();
  };

  const onRecDelete = () => {
    clearRecording();
    setRecLabel('شروع ضبط');
  };

  const setTab = (next) => {
    setTab_(next);
    const rec = recorderRef.current;
    if (next !== 'voice' && rec && rec.state === 'recording') stopRecording();
    closePopover();
  };

  /* =========================================================
     ۷) ثبت و بستن فرم
  ========================================================= */
  const resetForm = () => {
    editorRef.current.innerHTML = '';
    attachmentsRef.current.forEach((a) => {
      if (a.preview) URL.revokeObjectURL(a.preview);
    });
    commitAttachments([]);
    dbClear('files').catch(() => { /* مهم نیست */ });
    clearRecording();
    setRecLabel('شروع ضبط');
    setTab('text');
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const ed = editorRef.current;
    const text = ed.textContent.trim();
    if (tab === 'text' && !text) {
      showToast('لطفاً متن بازخورد را وارد کنید.', true);
      ed.focus();
      return;
    }
    if (tab === 'voice') {
      const rec = recorderRef.current;
      if (rec && rec.state === 'recording') stopRecording();
      if (!recBlobRef.current) {
        showToast('لطفاً ابتدا صدای خود را ضبط کنید.', true);
        return;
      }
    }
    const list = attachmentsRef.current;
    const payload = {
      type: tab,
      html: tab === 'text' ? ed.innerHTML : null,
      text: tab === 'text' ? text : null,
      audio: tab === 'voice' ? recBlobRef.current : null,
      mentions: mentionIds,
      attachments: list.map((a) => ({ name: a.name, file: a.file })),
    };
    // ذخیره‌ی ماندگار بازخورد ثبت‌شده؛ اگر ذخیره نشد فرم دست‌نخورده می‌ماند
    const record = {
      created: Date.now(),
      type: payload.type,
      html: payload.html,
      text: payload.text,
      mentions: payload.mentions,
      audio: payload.audio,
      attachments: list.map((a) => ({ name: a.name, type: a.file.type, size: a.file.size, blob: a.file })),
    };
    dbPut('feedbacks', record)
      .then(() => {
        // اینجا را به سرور وصل کنید؛ مثلاً با fetch یا FormData
        document.dispatchEvent(new CustomEvent('feedback:submit', { detail: payload }));
        showToast('بازخورد با موفقیت ثبت شد.');
        resetForm();
        loadHistory();
      })
      .catch(() => {
        showToast('ثبت بازخورد ممکن نشد؛ ذخیره‌سازی مرورگر در دسترس نیست.', true);
      });
  };

  const confirmClose = () => {
    closePopover();
    setClosed(true);
    setTimeout(() => setLayoutHidden(true), 200);
  };

  const reopen = () => {
    setLayoutHidden(false);
    setTimeout(() => setClosed(false), 20);
  };

  /* =========================================================
     ۸) تاریخچه + بازیابی بعد از رفرش
  ========================================================= */
  const loadHistory = () =>
    dbAll('feedbacks')
      .then((list) => {
        historyUrls.current.forEach((u) => URL.revokeObjectURL(u));
        historyUrls.current = [];
        list.sort((a, b) => b.created - a.created);
        const items = list.map((r) => {
          let audioUrl = null;
          if (r.type === 'voice' && r.audio) {
            audioUrl = URL.createObjectURL(r.audio);
            historyUrls.current.push(audioUrl);
          }
          const mentionNames = (r.mentions || [])
            .map((id) => {
              const u = USERS.filter((x) => x.id === id)[0];
              return u ? u.name : null;
            })
            .filter(Boolean);
          const files = (r.attachments || []).map((f) => {
            const url = URL.createObjectURL(f.blob);
            historyUrls.current.push(url);
            return { name: f.name, url };
          });
          return {
            id: r.id,
            type: r.type,
            when: new Date(r.created).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }),
            audioUrl,
            safeHtml: audioUrl ? '' : sanitizeHtml(r.html || ''),
            mentionNames,
            files,
          };
        });
        setHistory(items);
      })
      .catch(() => { /* بدون ذخیره‌سازی، تاریخچه‌ای نیست */ });

  const removeHistory = (id) => {
    dbDel('feedbacks', Number(id)).then(loadHistory).catch(dbFail);
  };

  const restoreFiles = (minNextId) =>
    dbAll('files')
      .then((rows) => {
        rows.sort((a, b) => a.id - b.id);
        const list = attachmentsRef.current.slice();
        rows.forEach((r) => {
          if (list.some((a) => a.id === r.id)) return;
          const f = new File([r.blob], r.name, { type: r.type });
          list.push({
            id: r.id, file: f, name: r.name,
            preview: /^image\//.test(r.type) ? URL.createObjectURL(f) : null,
          });
          nextId.current = Math.max(nextId.current, r.id + 1);
        });
        nextId.current = Math.max(nextId.current, minNextId || 1);
        commitAttachments(list);
      })
      .catch(() => { /* چیزی برای بازیابی نیست */ });

  const restoreRecording = () =>
    dbGet('kv', 'recording')
      .then((rec) => {
        if (!rec || !rec.blob) return;
        recBlobRef.current = rec.blob;
        recUrlRef.current = URL.createObjectURL(rec.blob);
        setRecUrl(recUrlRef.current);
        timerTextRef.current = rec.timer || '00:00';
        setTimerText(timerTextRef.current);
        setRecLabel('ضبط مجدد');
      })
      .catch(() => { /* چیزی برای بازیابی نیست */ });

  // بازیابی پیش‌نویس هنگام باز شدن صفحه
  useEffect(() => {
    if (initial && typeof initial.html === 'string' && editorRef.current) {
      editorRef.current.innerHTML = sanitizeHtml(initial.html);
    }
    restoring.current = false;
    Promise.all([restoreFiles(initial && initial.nextId), restoreRecording(), loadHistory()])
      .then(saveDraft, saveDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     رندر — ساختار و کلاس‌ها دقیقاً مطابق index.html اصلی
  ========================================================= */
  const renderPopoverContent = () => {
    switch (popover.key) {
      case 'link':
        return <LinkForm onSubmit={submitLink} onCancel={() => closePopover(true)} />;
      case 'align':
        return (
          <AlignList
            onPick={(cmd) => {
              exec(cmd);
              closePopover();
            }}
          />
        );
      case 'mention':
        return (
          <MentionPicker
            taken={mentions}
            onPick={(u) => {
              addMention(u);
              closePopover(true);
            }}
          />
        );
      case 'qr':
        return <QrHelp onClose={closePopover} />;
      case 'close':
        return <CloseConfirm onConfirm={confirmClose} onCancel={() => closePopover(true)} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div
        className="layout"
        style={{ opacity: closed ? 0 : 1, display: layoutHidden ? 'none' : undefined }}
      >
        {/* نوار بالایی */}
        <div className="nav">
          <div className="text-nav">
            <img src={avatar} alt="لوگوی علیرضا گودرزی" className="logo" />
            <span className="name">علیرضا گودرزی</span>
            <span className="text">این مورد باید به صورت تفصیلی گزارش برای آن ثبت شود</span>
          </div>

          <button
            type="button"
            className="login"
            id="closeBtn"
            aria-label="بستن"
            aria-haspopup="dialog"
            onClick={(e) => togglePopover('close', e.currentTarget)}
          >
            <CloseIcon />
          </button>
        </div>

        {/* تب‌ها */}
        <div className="layout2">
          <form className="nav2" id="tabsForm" onSubmit={prevent}>
            <button
              className={'txt1' + (tab === 'text' ? ' active' : '')}
              type="submit"
              data-tab="text"
              aria-pressed={tab === 'text'}
              onClick={(e) => { e.preventDefault(); setTab('text'); }}
            >
              ثبت بازخورد متنی جدید
            </button>
            <button
              className={'txt2' + (tab === 'voice' ? ' active' : '')}
              type="submit"
              data-tab="voice"
              aria-pressed={tab === 'voice'}
              onClick={(e) => { e.preventDefault(); setTab('voice'); }}
            >
              ثبت بازخورد صوتی جدید
            </button>
          </form>
        </div>

        {/* کارت بازخورد */}
        <div className="feedback-container" style={{ display: tab === 'text' ? undefined : 'none' }}>
          <div className="feedback-card">
            {/* نوار ابزار */}
            <div className="toolbar">
              <div className="toolbar-right">
                <button type="button" className={toolCls('underline')} data-cmd="underline"
                  title="زیرخط" aria-label="زیرخط" onMouseDown={prevent}
                  onClick={() => exec('underline')}>
                  <UnderlineIcon />
                </button>

                <button type="button" className={toolCls('quote')} data-cmd="quote"
                  title="نقل‌قول" aria-label="نقل‌قول" onMouseDown={prevent} onClick={onQuote}>
                  <QuoteIcon />
                </button>

                <button type="button" className={toolCls('italic')} data-cmd="italic"
                  title="کج (ایتالیک)" aria-label="کج (ایتالیک)" onMouseDown={prevent}
                  onClick={() => exec('italic')}>
                  <ItalicIcon />
                </button>

                <button type="button" className={toolCls('bold')} data-cmd="bold"
                  title="ضخیم (Bold)" aria-label="ضخیم" onMouseDown={prevent}
                  onClick={() => exec('bold')}>
                  <BoldIcon />
                </button>

                <button type="button" className="tool-btn" data-cmd="link"
                  title="افزودن پیوند" aria-label="افزودن پیوند" aria-haspopup="true"
                  aria-expanded={expanded('link')} onMouseDown={prevent}
                  onClick={(e) => { saveRange(); togglePopover('link', e.currentTarget); }}>
                  <LinkIcon />
                </button>

                <button type="button" className="tool-btn" data-cmd="align"
                  title="تراز متن" aria-label="تراز متن" aria-haspopup="true"
                  aria-expanded={expanded('align')} onMouseDown={prevent}
                  onClick={(e) => togglePopover('align', e.currentTarget)}>
                  <AlignIcon />
                  <ChevronIcon />
                </button>
              </div>
            </div>

            {/* ورودی متن */}
            <div className="textarea-wrapper">
              <div
                className="feedback-input"
                id="feedbackInput"
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="متن بازخورد"
                data-placeholder="متن بازخورد را اینجا وارد کنید..."
                onInput={handleInput}
                onPaste={handlePaste}
              ></div>
            </div>
          </div>
        </div>

        {/* پنل بازخورد صوتی */}
        <div className="voice-panel" id="voicePanel" hidden={tab !== 'voice'}>
          <button type="button" className={'rec-btn' + (recording ? ' recording' : '')}
            id="recBtn" aria-pressed={recording} onClick={onRecClick}>
            <span className="rec-dot"></span>
            <span className="rec-label">{recLabel}</span>
          </button>
          <span className="rec-timer" id="recTimer">{timerText}</span>
          <audio id="recAudio" controls hidden={!recUrl} src={recUrl || undefined}></audio>
          <button type="button" className="rec-delete" id="recDelete" hidden={!recUrl}
            onClick={onRecDelete}>
            حذف ضبط
          </button>
        </div>

        {/* ردیف پایین: فایل/سند بعد از کادر منشن */}
        <div className="bottom-row">
          {/* ۱. بخش منشن (سمت راست) */}
          <div className="mention-box" id="mentionBox">
            <span className="label">منشن:</span>

            {mentions.map((id) => {
              const user = USERS.filter((u) => u.id === id)[0];
              if (!user) return null;
              const cls = 'user-tag' + (removing.indexOf(id) > -1 ? ' removing' : '') +
                (fresh.indexOf(id) > -1 ? ' fade-in' : '');
              return (
                <div className={cls} data-user-id={id} key={id}>
                  <span className="avatar">
                    <img src={avatar} alt={user.name} />
                  </span>
                  <span className="name2">{user.name}</span>
                  <button className="close" type="button" aria-label="حذف منشن"
                    onClick={() => removeMention(id)}>
                    <RemoveMentionIcon />
                  </button>
                </div>
              );
            })}
            <button type="button" className="add-mention" id="addMention" aria-label="افزودن منشن"
              aria-haspopup="true" aria-expanded={expanded('mention')}
              onClick={(e) => togglePopover('mention', e.currentTarget)}>
              +
            </button>
          </div>

          {/* ۲. بخش فایل / سند (سمت چپ / بعد از منشن) */}
          <div className="after-mention" id="fileToggle" role="button" tabIndex={0}
            aria-expanded={uploadOpen} aria-controls="uploadArea"
            onClick={toggleUpload} onKeyDown={onKeyActivate}>
            <span className="file-icon">
              <FileIcon />
            </span>
            <span className="file-text">فایل / سند</span>
          </div>
        </div>

        <div className={'slide' + (uploadOpen ? '' : ' closed')}>
          <div className="slide-inner">
            <div className="send" id="uploadArea">
              <div className="send-file">
                <span className="send-icon">
                  <SendIcon />
                </span>
                <div className="send-text-wrapper">
                  <span className="send-txt1">لطفا سند خود را از یکی از روش‌های روبرو بارگذاری کنید.</span>
                  <span className="send-txt2">فرمت‌های پشتیبانی شده : JPG, DOCX, PDF, PNG</span>
                </div>
              </div>
              <div className="link-img">
                <span className="send-link" id="qrOpt" role="button" tabIndex={0}
                  title="بارگذاری با موبایل (QR)" aria-haspopup="true" aria-expanded={expanded('qr')}
                  onKeyDown={onKeyActivate}
                  onClick={(e) => togglePopover('qr', e.currentTarget)}>
                  <QrIcon />
                </span>{' '}
                <span className={'sendfile' + (dragOver ? ' dragover' : '')} id="dropZone"
                  role="button" tabIndex={0} title="انتخاب یا رها کردن فایل"
                  onKeyDown={onKeyActivate}
                  onClick={() => fileInputRef.current.click()}
                  onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                  onDrop={onDrop}>
                  <DropIcon />
                </span>{' '}
                <span className="send-img" id="cameraOpt" role="button" tabIndex={0} title="دوربین"
                  onKeyDown={onKeyActivate}
                  onClick={() => imageInputRef.current.click()}>
                  <CameraIcon />
                </span>
              </div>
            </div>
          </div>
        </div>

        <ul className="file-list" id="fileList" aria-live="polite">
          {attachments.map((a) => (
            <li className="file-item" data-id={a.id} key={a.id}>
              {/^image\//.test(a.file.type) && <img src={a.preview} alt="" />}
              <span className="file-name" title={a.name}>{a.name}</span>
              <span className="file-size">{formatSize(a.file.size)}</span>
              <button type="button" className="file-remove" aria-label={'حذف ' + a.name}
                onClick={() => removeAttachment(a.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <input type="file" id="fileInput" accept=".jpg,.jpeg,.png,.pdf,.docx" multiple hidden
          ref={fileInputRef} onChange={onPickFiles} />
        <input type="file" id="imageInput" accept="image/jpeg,image/png" capture="environment" hidden
          ref={imageInputRef} onChange={onPickFiles} />

        <form id="submitForm" noValidate onSubmit={onSubmit}>
          <button type="submit" className="click">
            ثبت
          </button>
        </form>

        {/* بازخوردهای ثبت‌شده (ماندگار بعد از رفرش) */}
        <History items={history} onRemove={removeHistory} />
      </div>

      {/* دکمه نمایش دوباره فرم (بعد از بستن) */}
      {layoutHidden && (
        <button type="button" className="reopen" onClick={reopen}>
          نمایش دوباره فرم
        </button>
      )}

      {popover && (
        <Popover key={popover.key} anchor={popover.anchor} onClose={closePopover}>
          {renderPopoverContent()}
        </Popover>
      )}

      <Toast toast={toast} onDone={clearToast} />
    </>
  );
}
