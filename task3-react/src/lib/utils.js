export const MAX_FILE_SIZE = 10 * 1024 * 1024; // ۱۰ مگابایت
export const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'docx'];

// لیست نمونه‌ی کاربران برای منشن (بعداً از سرور بخوانید)
export const USERS = [
  { id: 1, name: 'علیرضا گودرزی' },
  { id: 2, name: 'سارا احمدی' },
  { id: 3, name: 'محمد رضایی' },
  { id: 4, name: 'مریم کریمی' },
  { id: 5, name: 'امیر حسینی' },
];

export function formatSize(bytes) {
  if (bytes >= 1048576) {
    return (
      (bytes / 1048576).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' مگابایت'
    );
  }
  return Math.max(1, Math.round(bytes / 1024)).toLocaleString('fa-IR') + ' کیلوبایت';
}

export function normalizeUrl(value) {
  value = (value || '').trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.\-]*:/i.test(value)) value = 'https://' + value;
  try {
    const u = new URL(value);
    if (u.protocol === 'mailto:') return u.href;
    if (
      (u.protocol === 'http:' || u.protocol === 'https:') &&
      (u.hostname.indexOf('.') > -1 || u.hostname === 'localhost')
    ) {
      return u.href;
    }
  } catch (err) {
    /* نامعتبر */
  }
  return null;
}

// فقط تگ‌ها و ویژگی‌های امن ادیتور اجازه‌ی بازیابی دارند
const ALLOWED_TAGS = {
  B: 1, STRONG: 1, I: 1, EM: 1, U: 1, A: 1, BLOCKQUOTE: 1, DIV: 1, BR: 1, P: 1, SPAN: 1,
};
const ALIGNS = ['left', 'right', 'center', 'justify'];

export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  (function clean(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) return;
      if (child.nodeType !== 1 || !ALLOWED_TAGS[child.tagName]) {
        child.remove();
        return;
      }
      const el = child;
      Array.from(el.attributes).forEach((at) => {
        const n = at.name.toLowerCase();
        const v = at.value;
        if (n === 'href' && el.tagName === 'A' && /^(https?:|mailto:)/i.test(v.trim())) return;
        if (n === 'style') {
          const m = /text-align:\s*(\w+)/i.exec(v);
          el.removeAttribute('style');
          if (m && ALIGNS.indexOf(m[1].toLowerCase()) > -1) {
            el.style.textAlign = m[1].toLowerCase();
          }
          return;
        }
        if (n === 'align' && ALIGNS.indexOf(v.toLowerCase()) > -1) return;
        el.removeAttribute(at.name);
      });
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
      clean(el);
    });
  })(doc.body);
  return doc.body.innerHTML;
}
