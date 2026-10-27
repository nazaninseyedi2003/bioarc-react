import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { fadeIn } from '../animate.js';

const EASE = 'cubic-bezier(0.37, 0, 0.63, 1)';

/* پیام موقت پایین صفحه: fadeIn ‏150ms، ماندن ‏2.5 ثانیه، fadeOut ‏250ms */
export function useToast() {
    const [toast, setToast] = useState({ msg: '', n: 0 });
    const show = useCallback((msg) => setToast((t) => ({ msg, n: t.n + 1 })), []);
    return [toast, show];
}

export default function Toast({ toast }) {
    const ref = useRef(null);
    const timer = useRef(null);
    const [visible, setVisible] = useState(false);

    useLayoutEffect(() => {
        if (!toast.n) { return undefined; }
        const el = ref.current;
        clearTimeout(timer.current);
        el.getAnimations().forEach((a) => a.cancel());
        setVisible(true);
        el.hidden = false;
        fadeIn(el, 150);
        timer.current = setTimeout(() => {
            const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: EASE, fill: 'forwards' });
            a.onfinish = () => setVisible(false);
        }, 2500);
        return () => clearTimeout(timer.current);
    }, [toast.n]);

    return (
        <div className="toast" id="toast" role="status" aria-live="polite" ref={ref} hidden={!visible}>
            {toast.msg}
        </div>
    );
}
