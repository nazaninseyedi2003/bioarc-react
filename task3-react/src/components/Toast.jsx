import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// توست: ۱۵۰ms ظاهر، ۲۶۰۰ms ماندن، ۲۵۰ms محو (انیمیشن در animations.css)
export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;
  return createPortal(
    <div key={toast.id} className={'toast' + (toast.isError ? ' error' : '')} role="status">
      {toast.msg}
    </div>,
    document.body
  );
}
