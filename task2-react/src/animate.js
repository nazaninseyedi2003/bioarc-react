/*
 * جایگزین slideDown / slideUp / fadeIn در jQuery با Web Animations API
 * (منحنی «swing» در jQuery همان easeInOutSine است).
 */
import { flushSync } from 'react-dom';

const EASE = 'cubic-bezier(0.37, 0, 0.63, 1)';
const SLIDE_PROPS = ['height', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'];

function slide(el, ms, down, done) {
    if (!el) { if (done) { done(); } return () => {}; }
    const cs = getComputedStyle(el);
    const full = {};
    const zero = {};
    SLIDE_PROPS.forEach((p) => { full[p] = cs[p]; zero[p] = '0px'; });

    const prevOverflow = el.style.overflow;
    el.style.overflow = 'hidden';

    const anim = el.animate(down ? [zero, full] : [full, zero], {
        duration: ms,
        easing: EASE,
        fill: down ? 'none' : 'forwards',
    });
    let finished = false;
    anim.onfinish = () => {
        finished = true;
        el.style.overflow = prevOverflow;
        // callback (حذف از state) را هم‌زمان اعمال می‌کنیم و بعد حالت «بسته» را برمی‌داریم،
        // وگرنه ارتفاعِ صفر روی المان می‌ماند و در باز شدن دوباره (مثل فرم) کوچک می‌ماند
        if (done) { flushSync(done); }
        anim.cancel();
    };
    // لغو (مثلاً در StrictMode یا unmount) بدون اجرای callback
    return () => {
        if (finished) { return; }
        anim.onfinish = null;
        anim.cancel();
        el.style.overflow = prevOverflow;
    };
}

export const slideDown = (el, ms, done) => slide(el, ms, true, done);
export const slideUp = (el, ms, done) => slide(el, ms, false, done);

export function fadeIn(el, ms) {
    if (!el) { return; }
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: EASE });
}
