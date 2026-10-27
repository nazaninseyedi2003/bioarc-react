import { useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import TabPanel from './TabPanel.jsx';
import FeedbackCard from './FeedbackCard.jsx';
import TextCard from './TextCard.jsx';
import VoiceCard from './VoiceCard.jsx';
import useVoiceRecorder from '../hooks/useVoiceRecorder.js';
import { slideDown, slideUp } from '../animate.js';
import { formatTime, TXT_CONFIRMED, TXT_UNCONFIRMED } from '../utils.js';
import {
    AddIcon, ResetIcon, PrintIcon, PdfIcon, ExcelIcon, MicIcon,
} from './icons.jsx';

export default function FeedbackPanel({ active }) {
    const { items, addItem, resetAll, addLog, showToast } = useApp();
    const rec = useVoiceRecorder({ showToast });

    const formRef = useRef(null);
    const textRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [formHidden, setFormHidden] = useState(true);
    const formHiddenRef = useRef(true);
    const openRequested = useRef(false);

    /* ---------- بازخورد جدید: باز و بسته شدن فرم ---------- */
    function toggleNewForm(show) {
        if (show === undefined) { show = formHiddenRef.current; }
        setExpanded(show);
        if (show) {
            openRequested.current = true;
            formHiddenRef.current = false;
            setFormHidden(false);
        } else {
            rec.resetVoice();
            if (formRef.current && !formHiddenRef.current) {
                slideUp(formRef.current, 140, () => {
                    formHiddenRef.current = true;
                    setFormHidden(true);
                });
            }
        }
    }

    useLayoutEffect(() => {
        if (!formHidden && openRequested.current) {
            openRequested.current = false;
            slideDown(formRef.current, 160, () => {
                if (textRef.current) { textRef.current.focus(); }
            });
        }
    }, [formHidden]);

    function submitForm(e) {
        e.preventDefault();
        const ta = textRef.current;
        const text = ta.value.trim();

        if (rec.recRef.current) {
            showToast('ابتدا ضبط ویس را پایان دهید.');
            return;
        }
        if (!text && !rec.pendingRef.current) {
            showToast('متن بازخورد را وارد کنید یا ویس ضبط کنید.');
            ta.focus();
            return;
        }

        if (rec.pendingRef.current) {
            const v = rec.pendingRef.current;
            addItem({
                id: 'voice-' + Date.now(),
                kind: 'voice',
                isNew: true,
                userName: 'شما',
                status: 'unconfirmed',
                timeText: 'هم‌اکنون',
                blocks: text ? [{ type: 'text', text }] : [],
                voice: {
                    duration: v.duration,
                    peaks: v.peaks,
                    audio: new Audio(v.url),
                    url: v.url,
                    filename: v.filename,
                },
            });
            rec.releasePending(false); // URL حالا مال کارت است
            ta.value = '';
            toggleNewForm(false);
            addLog('بازخورد صوتی ثبت شد (' + formatTime(v.duration) + ').');
            showToast('ویس ثبت شد.');
            return;
        }

        addItem({
            id: 'text-' + Date.now(),
            kind: 'text',
            isNew: true,
            userName: 'شما',
            status: 'unconfirmed',
            blocks: [{ type: 'text', text }],
        });
        ta.value = '';
        toggleNewForm(false);
        addLog('بازخورد جدید ثبت شد.');
        showToast('بازخورد ثبت شد.');
    }

    /* ---------- نوار ابزار: بازنشانی / چاپ / PDF / اکسل ---------- */
    function reset() {
        if (!window.confirm('همه‌ی تغییرات به حالت اولیه برگردد؟')) { return; }
        rec.resetVoice();
        resetAll(); // همه‌ی ویس‌ها آزاد می‌شوند و این پنل از نو ساخته می‌شود
        addLog('صفحه به حالت اولیه بازنشانی شد.');
        showToast('بازنشانی انجام شد.');
    }

    function exportExcel() {
        const rows = [['کاربر', 'نوع', 'وضعیت', 'متن']];
        items.forEach((it) => {
            const status = it.status === 'confirmed' ? TXT_CONFIRMED : TXT_UNCONFIRMED;
            const text = it.blocks.filter((b) => b.type === 'text').map((b) => b.text.trim()).join(' | ').trim();
            rows.push([it.userName, it.kind === 'voice' ? 'ویس' : 'متن', status, text]);
        });

        const csv = rows
            .map((r) => r.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
            .join('\r\n');

        // BOM برای نمایش درست فارسی در اکسل
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'feedbacks.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        addLog('خروجی اکسل (CSV) گرفته شد.');
    }

    function exportPdf() {
        showToast('در پنجره‌ی چاپ، مقصد را «Save as PDF» انتخاب کنید.');
        setTimeout(() => window.print(), 600);
    }

    return (
        <TabPanel name="feedbacks" active={active}>
            {/* نوار ابزار بالا */}
            <div className="feedback-toolbar">
                <button
                    type="button"
                    className="add-feedback-btn"
                    aria-expanded={expanded}
                    aria-controls="newFeedbackForm"
                    onClick={() => toggleNewForm()}
                >
                    <span className="add-sign">
                        <AddIcon />
                    </span>
                    <span>بازخورد جدید</span>
                </button>
                <div className="action-buttons">
                    <button type="button" className="icon-btn" title="بازنشانی" aria-label="بازنشانی" onClick={reset}>
                        <ResetIcon />
                    </button>
                    <button type="button" className="icon-btn" title="چاپ" aria-label="چاپ" onClick={() => window.print()}>
                        <PrintIcon />
                    </button>
                    <button type="button" className="icon-btn" title="خروجی PDF" aria-label="خروجی PDF" onClick={exportPdf}>
                        <PdfIcon />
                    </button>
                    <button type="button" className="icon-btn" title="خروجی اکسل" aria-label="خروجی اکسل" onClick={exportExcel}>
                        <ExcelIcon />
                    </button>
                </div>
            </div>

            {/* فرم افزودن بازخورد جدید */}
            <form className="inline-form" id="newFeedbackForm" ref={formRef} hidden={formHidden} onSubmit={submitForm}>
                <label htmlFor="newFeedbackText" className="inline-form-label">متن بازخورد</label>
                <textarea
                    id="newFeedbackText"
                    ref={textRef}
                    rows={3}
                    maxLength={500}
                    placeholder="بازخورد خود را بنویسید..."
                />

                {/* ضبط ویس (MediaRecorder) */}
                <div className="voice-recorder" id="voiceRecorder" data-mode={rec.mode}>
                    <span className="inline-form-label">ویس (اختیاری)</span>

                    <div className="rec-idle" hidden={rec.mode !== 'idle'}>
                        <button
                            type="button"
                            className="btn btn-ghost rec-btn"
                            disabled={rec.startDisabled}
                            onClick={rec.startRecording}
                        >
                            <MicIcon />
                            <span>ضبط ویس</span>
                        </button>
                        <span className="rec-hint">حداکثر ۵ دقیقه · برای ضبط، اجازه‌ی دسترسی به میکروفون لازم است</span>
                    </div>

                    <div className="rec-live" hidden={rec.mode !== 'recording'}>
                        <span className="rec-dot" aria-hidden="true" />
                        <span className="rec-timer" role="timer" aria-label="مدت زمان ضبط">{rec.timerText}</span>
                        <canvas className="rec-canvas" height="32" aria-hidden="true" ref={rec.canvasRef} />
                        <button
                            type="button"
                            className="btn btn-danger"
                            disabled={rec.stopDisabled}
                            onClick={rec.stopRecording}
                        >
                            پایان ضبط
                        </button>
                    </div>

                    <div className="rec-done" hidden={rec.mode !== 'recorded'}>
                        <audio
                            className="rec-audio"
                            controls
                            preload="metadata"
                            aria-label="پیش‌نمایش ویس ضبط‌شده"
                            ref={rec.previewRef}
                        />
                        <button type="button" className="btn btn-ghost" onClick={rec.discard}>حذف و ضبط مجدد</button>
                    </div>
                </div>

                <div className="inline-form-actions">
                    <button type="submit" className="btn btn-primary">ثبت بازخورد</button>
                    <button type="button" className="btn btn-ghost" onClick={() => toggleNewForm(false)}>انصراف</button>
                </div>
            </form>

            {items.map((it) => {
                if (it.kind === 'voice') { return <VoiceCard key={it.id} item={it} />; }
                if (it.kind === 'text') { return <TextCard key={it.id} item={it} />; }
                return <FeedbackCard key={it.id} item={it} />;
            })}

            <p className="empty-state" id="feedbacksEmpty" hidden={items.length > 0}>
                بازخوردی وجود ندارد. با «بازخورد جدید» یکی اضافه کنید.
            </p>
        </TabPanel>
    );
}
