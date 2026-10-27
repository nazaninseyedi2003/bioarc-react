import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { slideDown, slideUp } from '../animate.js';
import { releaseVoice } from '../audioUtils.js';

/*
 * منطق مشترک هر سه نوع کارت: حذف، ویرایش، پاسخ، تغییر وضعیت
 */
export default function useCard(item) {
    const { addLog, showToast, updateItem, removeItem, toggleStatus, setPlayingId } = useApp();
    const ref = useRef(null);
    const leaving = useRef(false);

    const [editing, setEditing] = useState(false);
    const [editVersion, setEditVersion] = useState(0);
    const targets = useRef([]);              // المان‌های متنیِ قابل ویرایش
    const [replyOpen, setReplyOpen] = useState(false);
    const [replies, setReplies] = useState([]);
    const replyFormRef = useRef(null);

    const textIndexes = item.blocks.reduce((acc, b, i) => (b.type === 'text' ? acc.concat(i) : acc), []);

    /* ---------- ورود کارت جدید ---------- */
    useLayoutEffect(() => {
        if (!item.isNew) { return undefined; }
        return slideDown(ref.current, 220);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------- حذف ---------- */
    const remove = useCallback(() => {
        if (leaving.current) { return; }
        if (!window.confirm('این بازخورد حذف شود؟')) { return; }
        leaving.current = true;
        setPlayingId(null);
        releaseVoice(item.voice);
        slideUp(ref.current, 220, () => removeItem(item.id));
        addLog('بازخورد «' + item.userName + '» حذف شد.');
    }, [addLog, item.id, item.userName, item.voice, removeItem, setPlayingId]);

    /* ---------- ویرایش ---------- */
    const startEdit = useCallback(() => {
        if (!textIndexes.length) {
            showToast('این مورد متنی برای ویرایش ندارد.');
            return;
        }
        if (editing) { return; }
        setEditing(true);
    }, [editing, showToast, textIndexes.length]);

    useEffect(() => {
        if (editing && targets.current[0]) { targets.current[0].focus(); }
    }, [editing]);

    const endEdit = useCallback((save) => {
        if (save) {
            // فقط متن ساده نگه داشته می‌شود
            const blocks = item.blocks.map((b, i) => {
                const k = textIndexes.indexOf(i);
                return k === -1 ? b : { ...b, text: (targets.current[k].textContent || '').trim() };
            });
            updateItem(item.id, { blocks });
            addLog('بازخورد «' + item.userName + '» ویرایش شد.');
            showToast('تغییرات ذخیره شد.');
        }
        setEditing(false);
        setEditVersion((v) => v + 1); // متن‌ها از نو ساخته می‌شوند (ذخیره‌شده یا اصلی)
    }, [addLog, item.blocks, item.id, item.userName, showToast, textIndexes, updateItem]);

    /* ---------- پاسخ ---------- */
    const closeReply = useCallback(() => {
        slideUp(replyFormRef.current, 140, () => setReplyOpen(false));
    }, []);

    const toggleReply = useCallback(() => {
        if (replyOpen) { closeReply(); } else { setReplyOpen(true); }
    }, [closeReply, replyOpen]);

    const submitReply = useCallback((text) => {
        text = text.trim();
        if (!text) {
            showToast('متن پاسخ را وارد کنید.');
            return;
        }
        setReplies((r) => r.concat({ id: Date.now() + '-' + r.length, text }));
        closeReply();
        addLog('به بازخورد «' + item.userName + '» پاسخ داده شد.');
    }, [addLog, closeReply, item.userName, showToast]);

    /* ---------- وضعیت ---------- */
    const toggle = useCallback(() => toggleStatus(item.id), [item.id, toggleStatus]);

    return {
        ref, targets, editing, editVersion, replyOpen, replies, replyFormRef,
        remove, startEdit, endEdit, toggleReply, closeReply, submitReply, toggle,
        textIndexes,
    };
}
