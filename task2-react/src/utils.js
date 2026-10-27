const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toFa(value) {
    return String(value).replace(/\d/g, (d) => FA_DIGITS[d]);
}

export function formatTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return toFa(m + ':' + (s < 10 ? '0' + s : s));
}

export const TXT_UNCONFIRMED = 'تایید نشده';
export const TXT_CONFIRMED = 'تایید شده';
