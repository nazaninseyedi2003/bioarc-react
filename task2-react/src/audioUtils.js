/*
 * فایل‌های MediaRecorder در کروم معمولاً مدت (duration) ندارند و جابه‌جایی در آن‌ها درست کار نمی‌کند.
 * با پرش به یک زمان خیلی بزرگ، مرورگر مدت واقعی را حساب می‌کند؛ بعد به ابتدا برمی‌گردیم.
 * خروجی: تابع لغو (حذف listenerها)
 */
export function prepareAudio(audio, onDuration) {
    function report() {
        if (isFinite(audio.duration) && audio.duration > 0 && onDuration) { onDuration(audio.duration); }
    }
    let onTime = null;
    function onMeta() {
        if (audio.duration === Infinity || isNaN(audio.duration)) {
            onTime = function () {
                audio.removeEventListener('timeupdate', onTime);
                audio.currentTime = 0;
                report();
            };
            audio.addEventListener('timeupdate', onTime);
            audio.currentTime = 1e101;
        } else {
            report();
        }
    }
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', onMeta);
    return () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        if (onTime) { audio.removeEventListener('timeupdate', onTime); }
    };
}

// آزاد کردن منابع ویس‌هایی که کاربر ضبط کرده (Blob URL)
export function releaseVoice(voice) {
    if (!voice) { return; }
    if (voice.audio) {
        voice.audio.pause();
        voice.audio.removeAttribute('src');
        try { voice.audio.load(); } catch (err) { /* بی‌اهمیت */ }
    }
    if (voice.url) { URL.revokeObjectURL(voice.url); voice.url = null; }
}
