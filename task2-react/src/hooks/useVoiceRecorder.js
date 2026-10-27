import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareAudio } from '../audioUtils.js';
import { formatTime } from '../utils.js';

const MAX_REC_SEC = 300; // حداکثر مدت ضبط (۵ دقیقه)
const MIN_REC_SEC = 1;   // کوتاه‌تر از این ثبت نمی‌شود

function pickMime() {
    const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (let i = 0; i < list.length; i++) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(list[i])) { return list[i]; }
    }
    return '';
}

function extFor(type) {
    type = String(type || '');
    if (type.indexOf('mp4') > -1) { return 'm4a'; }
    if (type.indexOf('ogg') > -1) { return 'ogg'; }
    return 'webm';
}

function micErrorMessage(err) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
        return 'دسترسی به میکروفون مجاز نیست. اجازه‌ی میکروفون را در تنظیمات مرورگر فعال کنید.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        return 'میکروفونی پیدا نشد.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'میکروفون در اختیار برنامه‌ی دیگری است.';
    }
    return 'شروع ضبط ممکن نشد.';
}

function stopStream(stream) {
    stream.getTracks().forEach((t) => t.stop());
}

function drawLive(canvas, r) {
    const dpr = window.devicePixelRatio || 1;
    // اندازه‌ی بوم باید با اندازه‌ی واقعیِ نمایش‌داده‌شده هماهنگ باشد
    const wantW = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    if (canvas.clientWidth > 0 && canvas.width !== wantW) { canvas.width = wantW; }
    const wantH = Math.floor(32 * dpr);
    if (canvas.height !== wantH) { canvas.height = wantH; }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const step = 5 * dpr;
    const bw = 3 * dpr;
    const count = Math.floor(w / step);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#132D84';
    const bars = r.peaks.slice(-(count - 1)).concat([r.level]);
    for (let k = 0; k < bars.length; k++) {
        const bh = Math.max(3 * dpr, bars[k] * h);
        const x = w - (bars.length - k) * step;
        ctx.fillRect(x, (h - bh) / 2, bw, bh);
    }
}

/*
 * ضبط ویس با MediaRecorder
 * mode: 'idle' | 'recording' | 'recorded'
 */
export default function useVoiceRecorder({ showToast }) {
    const [mode, setMode] = useState('idle');
    const [startDisabled, setStartDisabled] = useState(false);
    const [stopDisabled, setStopDisabled] = useState(false);
    const [timerText, setTimerText] = useState(formatTime(0));

    const recRef = useRef(null);       // ضبطِ در حال انجام
    const pendingRef = useRef(null);   // ویس ضبط‌شده‌ای که هنوز ثبت نشده
    const tokenRef = useRef(0);        // برای نادیده گرفتن درخواست‌های میکروفونِ لغوشده
    const canvasRef = useRef(null);
    const previewRef = useRef(null);

    const setRecMode = useCallback((m) => {
        setMode(m);
        setStartDisabled(false);
        setStopDisabled(false);
    }, []);

    // پیش‌نمایشِ ویس ضبط‌شده: مدت واقعی فایل‌های MediaRecorder
    useEffect(() => prepareAudio(previewRef.current, null), []);

    // revoke=false وقتی است که مالکیت URL به کارت ثبت‌شده منتقل می‌شود
    const releasePending = useCallback((revoke) => {
        const audio = previewRef.current;
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            try { audio.load(); } catch (err) { /* بی‌اهمیت */ }
        }
        if (pendingRef.current && revoke) { URL.revokeObjectURL(pendingRef.current.url); }
        pendingRef.current = null;
    }, []);

    const cleanupRec = (r) => {
        clearInterval(r.tick);
        cancelAnimationFrame(r.raf);
        stopStream(r.stream);
        if (r.ctx && r.ctx.close) { r.ctx.close().catch(() => {}); }
    };

    const finishRecording = useCallback((r) => {
        if (r.finished) { return; }
        r.finished = true;
        cleanupRec(r);
        if (recRef.current === r) { recRef.current = null; }
        if (r.canceled) { return; }

        const duration = ((r.stoppedAt || Date.now()) - r.startedAt) / 1000;
        if (!r.chunks.length || duration < MIN_REC_SEC) {
            setRecMode('idle');
            showToast('ضبط خیلی کوتاه بود؛ دوباره تلاش کنید.');
            return;
        }

        const type = r.mime || r.chunks[0].type || 'audio/webm';
        const blob = new Blob(r.chunks, { type });

        // نرمال‌سازی قله‌ها تا موج کارت خوانا باشد
        let top = 0.08;
        r.peaks.forEach((v) => { top = Math.max(top, v); });
        const peaks = (r.peaks.length ? r.peaks : [0.3]).map((v) => Math.min(1, v / top));

        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        pendingRef.current = {
            blob, url: URL.createObjectURL(blob), duration, peaks,
            filename: 'voice-' + stamp + '.' + extFor(type),
        };

        previewRef.current.src = pendingRef.current.url;
        setRecMode('recorded');
    }, [setRecMode, showToast]);

    const stopRecording = useCallback(() => {
        const r = recRef.current;
        if (!r || r.stopping) { return; }
        r.stopping = true;
        r.stoppedAt = Date.now();
        clearInterval(r.tick);
        cancelAnimationFrame(r.raf);
        setStopDisabled(true);
        if (r.recorder.state !== 'inactive') { r.recorder.stop(); } else { finishRecording(r); }
    }, [finishRecording]);

    const beginRecording = useCallback((stream) => {
        const mime = pickMime();
        let recorder;
        try {
            recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        } catch (err) {
            stopStream(stream);
            setRecMode('idle');
            showToast('ضبط صدا در این مرورگر ممکن نیست.');
            return;
        }

        const r = {
            stream, recorder, chunks: [], peaks: [], curMax: 0, level: 0,
            mime: recorder.mimeType || mime || '', startedAt: Date.now(), stoppedAt: 0,
            canceled: false, ctx: null, analyser: null, data: null, raf: 0, tick: 0,
        };
        recRef.current = r;

        // اندازه‌گیری تراز صدا برای موج زنده و موج کارت
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                r.ctx = new AC();
                r.analyser = r.ctx.createAnalyser();
                r.analyser.fftSize = 1024;
                r.data = new Uint8Array(r.analyser.fftSize);
                r.ctx.createMediaStreamSource(stream).connect(r.analyser);
                if (r.ctx.state === 'suspended') { r.ctx.resume(); }
            }
        } catch (err) { r.analyser = null; }

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size) { r.chunks.push(e.data); }
        };
        recorder.onerror = () => {
            showToast('در ضبط صدا خطایی رخ داد.');
            r.canceled = true;
            stopRecording();
        };
        recorder.onstop = () => finishRecording(r);

        recorder.start(250);
        setRecMode('recording');
        setTimerText(formatTime(0));

        r.tick = setInterval(() => {
            const sec = (Date.now() - r.startedAt) / 1000;
            r.peaks.push(r.curMax);
            r.curMax = 0;
            setTimerText(formatTime(sec));
            if (sec >= MAX_REC_SEC) {
                showToast('به حداکثر مدت ضبط (۵ دقیقه) رسیدید.');
                stopRecording();
            }
        }, 100);

        (function loop() {
            if (recRef.current !== r) { return; }
            let level;
            if (r.analyser) {
                r.analyser.getByteTimeDomainData(r.data);
                let peak = 0;
                for (let i = 0; i < r.data.length; i++) {
                    peak = Math.max(peak, Math.abs(r.data[i] - 128) / 128);
                }
                level = Math.min(1, peak * 1.6);
            } else {
                level = 0.3 + Math.random() * 0.3;
            }
            r.level = level;
            r.curMax = Math.max(r.curMax, level);
            if (canvasRef.current) { drawLive(canvasRef.current, r); }
            r.raf = requestAnimationFrame(loop);
        })();
    }, [finishRecording, setRecMode, showToast, stopRecording]);

    const startRecording = useCallback(() => {
        if (recRef.current) { return; }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !window.MediaRecorder) {
            showToast('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند (یا صفحه با HTTPS/localhost باز نشده است).');
            return;
        }
        releasePending(true);
        const token = ++tokenRef.current;
        setStartDisabled(true);

        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
            .then((stream) => {
                if (token !== tokenRef.current) { stopStream(stream); return; } // فرم بسته یا بازنشانی شده
                beginRecording(stream);
            }, (err) => {
                if (token !== tokenRef.current) { return; }
                setRecMode('idle');
                showToast(micErrorMessage(err));
            });
    }, [beginRecording, releasePending, setRecMode, showToast]);

    const discard = useCallback(() => {
        releasePending(true);
        setRecMode('idle');
    }, [releasePending, setRecMode]);

    // لغو ضبط جاری + حذف ویس ضبط‌شده‌ی ثبت‌نشده (بسته شدن فرم / بازنشانی)
    const resetVoice = useCallback(() => {
        tokenRef.current++;
        if (recRef.current) { recRef.current.canceled = true; stopRecording(); }
        releasePending(true);
        setRecMode('idle');
    }, [releasePending, setRecMode, stopRecording]);

    // اگر کامپوننت حذف شد، ضبط جاری و میکروفون آزاد شود
    useEffect(() => () => {
        const r = recRef.current;
        if (r) { r.canceled = true; r.finished = true; cleanupRec(r); recRef.current = null; }
    }, []);

    return {
        mode, startDisabled, stopDisabled, timerText,
        canvasRef, previewRef,
        recRef, pendingRef,
        startRecording, stopRecording, discard, resetVoice, releasePending,
    };
}
