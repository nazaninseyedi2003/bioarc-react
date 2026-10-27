import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { WAVE_PATTERN } from '../waveformPattern.js';
import { prepareAudio } from '../audioUtils.js';
import { formatTime } from '../utils.js';

const COLOR_PLAYED = '#132D84';
const COLOR_IDLE = '#DDE1F0';
const BAR_STEP = 7; // فاصله‌ی افقی هر میله‌ی موج صوتی (px)

// ارتفاع میله‌ی i‌ام از روی قله‌های واقعیِ صدا
function peakBar(peaks, i, count) {
    const n = peaks.length;
    const lo = Math.floor((i * n) / count);
    const hi = Math.max(lo + 1, Math.floor(((i + 1) * n) / count));
    let max = 0;
    let sum = 0;
    for (let k = lo; k < hi && k < n; k++) {
        max = Math.max(max, peaks[k]);
        sum += peaks[k];
    }
    const v = (max + sum / (hi - lo)) / 2;
    const h = 3 + Math.round(v * 18);
    return { y: (21 - h) / 2, h };
}

/*
 * پخش‌کننده‌ی ویس.
 * - ویس نمونه (voice.audio === null): پخش شبیه‌سازی می‌شود.
 * - ویس ضبط‌شده: از المان Audio واقعی پخش می‌شود.
 */
export default function AudioPlayer({ item }) {
    const { showToast, playingId, setPlayingId, updateItem } = useApp();
    const voice = item.voice;
    const { audio, peaks, duration } = voice;

    const wrapRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [position, setPosition] = useState(0);
    const [playing, setPlaying] = useState(false);

    // آخرین مقادیر برای استفاده در intervalها (جلوگیری از stale closure)
    const posRef = useRef(0);
    const durRef = useRef(duration);
    durRef.current = duration;

    /* ---------- موج صوتی: اندازه‌گیری عرض (در شروع و با تغییر اندازه‌ی پنجره) ---------- */
    useLayoutEffect(() => {
        const measure = () => {
            const w = parseFloat(getComputedStyle(wrapRef.current).width) || 0;
            setWidth(Math.max(w, BAR_STEP * 10));
        };
        measure();
        let timer = null;
        const onResize = () => {
            clearTimeout(timer);
            timer = setTimeout(measure, 150);
        };
        window.addEventListener('resize', onResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    const count = Math.floor(width / BAR_STEP);
    const bars = [];
    for (let i = 0; i < count; i++) {
        bars.push(peaks ? peakBar(peaks, i, count) : WAVE_PATTERN[i % WAVE_PATTERN.length]);
    }

    /* ---------- کنترل پخش ---------- */
    const pause = useCallback(() => {
        setPlaying(false);
        if (audio) { audio.pause(); }
    }, [audio]);

    const play = useCallback(() => {
        if (posRef.current >= durRef.current) {
            posRef.current = 0;
            setPosition(0);
        }
        setPlaying(true);
        setPlayingId(item.id); // هم‌زمان فقط یک ویس پخش شود
        if (audio) {
            const started = audio.play();
            if (started && started.catch) {
                started.catch(() => { pause(); showToast('پخش ویس ممکن نشد.'); });
            }
        }
    }, [audio, item.id, pause, setPlayingId, showToast]);

    // اگر ویس دیگری شروع به پخش کرد، این یکی متوقف شود
    useEffect(() => {
        if (playing && playingId !== item.id) { pause(); }
    }, [playing, playingId, item.id, pause]);

    // پیشرفت پخش (هر ۱۰۰ میلی‌ثانیه)
    useEffect(() => {
        if (!playing) { return undefined; }
        let timer;
        if (audio) {
            // ویس واقعی: موقعیت از خودِ صدا خوانده می‌شود
            timer = setInterval(() => {
                posRef.current = Math.min(audio.currentTime, durRef.current);
                setPosition(posRef.current);
            }, 100);
        } else {
            timer = setInterval(() => {
                posRef.current += 0.1;
                if (posRef.current >= durRef.current) {
                    posRef.current = 0;
                    setPlaying(false);
                }
                setPosition(posRef.current);
            }, 100);
        }
        return () => clearInterval(timer);
    }, [playing, audio]);

    // اتصال المان صدا: مدت واقعی و پایان پخش
    useEffect(() => {
        if (!audio) { return undefined; }
        const cancelPrepare = prepareAudio(audio, (d) => updateItem(item.id, { voice: { ...voice, duration: d } }));
        const onEnded = () => {
            posRef.current = 0;
            try { audio.currentTime = 0; } catch (err) { /* بی‌اهمیت */ }
            setPlaying(false);
            audio.pause();
            setPosition(0);
        };
        audio.addEventListener('ended', onEnded);
        return () => {
            cancelPrepare();
            audio.removeEventListener('ended', onEnded);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audio]);

    const seekTo = (ratio) => {
        posRef.current = Math.min(1, Math.max(0, ratio)) * duration;
        if (audio) {
            try { audio.currentTime = posRef.current; } catch (err) { /* هنوز بارگذاری نشده */ }
        }
        setPosition(posRef.current);
    };

    const onWaveClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        seekTo((e.clientX - rect.left) / rect.width);
    };

    const onWaveKeyDown = (e) => {
        const step = 5;
        if (e.key === 'ArrowRight') { seekTo((posRef.current + step) / duration); }
        else if (e.key === 'ArrowLeft') { seekTo((posRef.current - step) / duration); }
        else if (e.key === 'Home') { seekTo(0); }
        else if (e.key === 'End') { seekTo(1); }
        else { return; }
        e.preventDefault();
    };

    /* ---------- نمایش ---------- */
    const ratio = position / duration;
    const played = Math.round(ratio * count);
    const idle = position === 0;

    return (
        <div className="audio-player">
            <button
                className="play-btn"
                type="button"
                aria-label={playing ? 'توقف ویس' : 'پخش ویس'}
                aria-pressed={playing}
                onClick={() => (playing ? pause() : play())}
            >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
                    <rect width="37.1867" height="37.7286" rx="18.5934" fill="#36459B" />
                    {playing ? (
                        <>
                            <rect className="play-glyph" x="12.6433" y="11.3171" width="4.46241" height="15.0914" rx="2" fill="white" />
                            <rect className="play-glyph" x="20.0807" y="11.3171" width="4.46241" height="15.0914" rx="2" fill="white" />
                        </>
                    ) : (
                        <path className="play-glyph" d="M15.2 11.6 26.6 18.9 15.2 26.2Z" fill="white" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                    )}
                </svg>
            </button>

            <div
                className="waveform-container"
                ref={wrapRef}
                role="slider"
                tabIndex={0}
                aria-label="موقعیت پخش ویس"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(ratio * 100)}
                onClick={onWaveClick}
                onKeyDown={onWaveKeyDown}
            >
                <svg className="waveform" viewBox={`0 0 ${width} 21`} preserveAspectRatio="none" fill="none" aria-hidden="true">
                    {bars.map((p, i) => (
                        <rect
                            key={i}
                            x={i * BAR_STEP}
                            y={p.y}
                            width="3"
                            height={p.h}
                            rx="1.5"
                            fill={i < played ? COLOR_PLAYED : COLOR_IDLE}
                        />
                    ))}
                </svg>
            </div>
            <span className="audio-time">{formatTime(idle ? duration : duration - position)}</span>
        </div>
    );
}
