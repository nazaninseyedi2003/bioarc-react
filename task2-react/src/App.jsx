import { useCallback, useMemo, useRef, useState } from 'react';
import { AppContext } from './AppContext.jsx';
import { createInitialItems } from './initialData.js';
import { releaseVoice } from './audioUtils.js';
import { formatTime, TXT_CONFIRMED, TXT_UNCONFIRMED } from './utils.js';
import { FlashIcon } from './components/icons.jsx';
import TabPanel from './components/TabPanel.jsx';
import FeedbackPanel from './components/FeedbackPanel.jsx';
import Toast, { useToast } from './components/Toast.jsx';

const TABS = [
    { name: 'feedbacks', label: 'بازخوردها' },
    { name: 'logs', label: 'لاگ‌ها' },
    { name: 'attachments', label: 'پیوست‌ها' },
];

let logSeq = 0;

export default function App() {
    const [tab, setTab] = useState('feedbacks');
    const [items, setItems] = useState(createInitialItems);
    const [logs, setLogs] = useState([]);
    const [playingId, setPlayingId] = useState(null);
    const [resetKey, setResetKey] = useState(0);
    const [toast, showToast] = useToast();
    const tabRefs = useRef([]);

    // آخرین وضعیت آیتم‌ها برای callbackهایی که خارج از رندر اجرا می‌شوند
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const addLog = useCallback((text) => {
        setLogs((l) => [{ id: ++logSeq, text, time: new Date() }, ...l]);
    }, []);

    const addItem = useCallback((item) => setItems((l) => [item, ...l]), []);

    const updateItem = useCallback((id, patch) => {
        setItems((l) => l.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    }, []);

    const removeItem = useCallback((id) => {
        const it = itemsRef.current.find((x) => x.id === id);
        if (it) { releaseVoice(it.voice); }
        setItems((l) => l.filter((x) => x.id !== id));
    }, []);

    const toggleStatus = useCallback((id) => {
        const it = itemsRef.current.find((x) => x.id === id);
        if (!it) { return; }
        const next = it.status === 'confirmed' ? 'unconfirmed' : 'confirmed';
        updateItem(id, { status: next });
        addLog('وضعیت بازخورد «' + it.userName + '» به «' +
            (next === 'confirmed' ? TXT_CONFIRMED : TXT_UNCONFIRMED) + '» تغییر کرد.');
    }, [addLog, updateItem]);

    // بازنشانی: توقف و آزادسازی همه‌ی ویس‌ها، بازگشت به داده‌ی اولیه
    const resetAll = useCallback(() => {
        itemsRef.current.forEach((it) => releaseVoice(it.voice));
        setPlayingId(null);
        setItems(createInitialItems());
        setResetKey((k) => k + 1);
    }, []);

    const ctx = useMemo(() => ({
        items, addItem, updateItem, removeItem, toggleStatus, resetAll,
        addLog, showToast, playingId, setPlayingId,
    }), [items, addItem, updateItem, removeItem, toggleStatus, resetAll, addLog, showToast, playingId]);

    /* ---------- تب‌ها ---------- */
    function selectTab(name) {
        if (name !== tab) { setTab(name); }
    }

    // جابه‌جایی بین تب‌ها با کلیدهای جهت‌دار
    function onTabKeyDown(e, index) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') { return; }
        // در صفحه‌ی راست‌به‌چپ، کلید چپ یعنی تب بعدی
        const i = index + (e.key === 'ArrowLeft' ? 1 : -1);
        const next = (i + TABS.length) % TABS.length;
        tabRefs.current[next].focus();
        selectTab(TABS[next].name);
        e.preventDefault();
    }

    /* ---------- پیوست‌ها: عکس‌ها و ویس‌ها به ترتیب نمایش ---------- */
    const images = [];
    items.forEach((it) => it.blocks.forEach((b) => { if (b.type === 'image') { images.push(b.src); } }));
    const voices = items.filter((it) => it.kind === 'voice');
    const hasAttachments = images.length + voices.length > 0;

    return (
        <AppContext.Provider value={ctx}>
            <div className="main-container">
                {/* بخش هدر و تب‌ها */}
                <div className="header-tabs">
                    <div className="header-title">
                        <span className="header-flash">
                            <FlashIcon />
                        </span>
                        <span className="header-txt">فعالیت‌ها</span>
                    </div>

                    <div className="tabs-list" role="tablist">
                        {TABS.map((t, i) => (
                            <button
                                key={t.name}
                                ref={(el) => { tabRefs.current[i] = el; }}
                                type="button"
                                role="tab"
                                id={'tab-' + t.name}
                                aria-controls={'panel-' + t.name}
                                aria-selected={tab === t.name}
                                className={tab === t.name ? 'active' : undefined}
                                onClick={() => selectTab(t.name)}
                                onKeyDown={(e) => onTabKeyDown(e, i)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* بدنه اصلی */}
                <div className="tab-content">
                    <FeedbackPanel key={resetKey} active={tab === 'feedbacks'} />

                    <TabPanel name="logs" active={tab === 'logs'}>
                        <ul className="logs-list" id="logsList">
                            {logs.map((l) => (
                                <li key={l.id}>
                                    <span>{l.text}</span>
                                    <time>{l.time.toLocaleTimeString('fa-IR')}</time>
                                </li>
                            ))}
                        </ul>
                        <p className="empty-state" id="logsEmpty" hidden={logs.length > 0}>هنوز لاگی ثبت نشده است.</p>
                    </TabPanel>

                    <TabPanel name="attachments" active={tab === 'attachments'}>
                        <ul className="attach-list" id="attachList">
                            {images.map((src, i) => {
                                const name = src.split('/').pop();
                                return (
                                    <li key={'img-' + i}>
                                        <img src={src} alt={name} />
                                        <span>{name}</span>
                                        <span className="attach-kind">تصویر</span>
                                    </li>
                                );
                            })}
                            {voices.map((v) => (
                                <li key={v.id}>
                                    <span>پیام صوتی</span>
                                    <span className="attach-kind">{formatTime(v.voice.duration)}</span>
                                    {v.voice.url && (
                                        <a className="attach-link" href={v.voice.url} download={v.voice.filename}>دانلود</a>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <p className="empty-state" id="attachEmpty" hidden={hasAttachments}>پیوستی وجود ندارد.</p>
                    </TabPanel>
                </div>
            </div>

            <Toast toast={toast} />
        </AppContext.Provider>
    );
}
