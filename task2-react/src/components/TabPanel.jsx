import { useLayoutEffect, useRef } from 'react';
import { fadeIn } from '../animate.js';

export default function TabPanel({ name, active, children }) {
    const ref = useRef(null);
    const prevActive = useRef(active);

    // هنگام باز شدن تب، پنل با fadeIn نمایش داده می‌شود
    useLayoutEffect(() => {
        if (active && !prevActive.current) { fadeIn(ref.current, 180); }
        prevActive.current = active;
    }, [active]);

    return (
        <div
            className="tab-panel"
            id={'panel-' + name}
            role="tabpanel"
            aria-labelledby={'tab-' + name}
            hidden={!active}
            ref={ref}
        >
            {children}
        </div>
    );
}
