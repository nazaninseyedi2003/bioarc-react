import { useLayoutEffect, useRef } from 'react';
import { slideDown } from '../animate.js';

/* متن قابل ویرایش (contenteditable فقط در حالت ویرایش) */
export function EditableText({ as: Tag = 'div', className, text, editing, index, card }) {
    return (
        <Tag
            key={card.editVersion}
            ref={(el) => { card.targets.current[index] = el; }}
            className={className}
            contentEditable={editing ? true : undefined}
            suppressContentEditableWarning
            onKeyDown={editing ? (e) => { if (e.key === 'Escape') { card.endEdit(false); } } : undefined}
        >
            {text}
        </Tag>
    );
}

function ReplyItem({ text }) {
    const ref = useRef(null);
    useLayoutEffect(() => slideDown(ref.current, 160), []);
    return (
        <div className="reply-wrapper" ref={ref}>
            <span className="reply-badge">پاسخ:</span>
            <div className="reply-banner">
                <span className="reply-text" style={{ whiteSpace: 'normal' }}>{text}</span>
            </div>
        </div>
    );
}

function ReplyForm({ card }) {
    const taRef = useRef(null);
    useLayoutEffect(() => {
        const el = card.replyFormRef.current;
        return slideDown(el, 160, () => { if (taRef.current) { taRef.current.focus(); } });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <form
            className="inline-form card-form"
            ref={card.replyFormRef}
            onSubmit={(e) => {
                e.preventDefault();
                card.submitReply(taRef.current.value);
            }}
        >
            <label className="inline-form-label">پاسخ شما</label>
            <textarea ref={taRef} rows={2} maxLength={500} placeholder="پاسخ را بنویسید..." />
            <div className="inline-form-actions">
                <button type="submit" className="btn btn-primary">ارسال پاسخ</button>
                <button type="button" className="btn btn-ghost" onClick={card.closeReply}>انصراف</button>
            </div>
        </form>
    );
}

/* پاسخ‌های ثبت‌شده، نوار ذخیره/انصراف ویرایش و فرم پاسخ؛ انتهای هر کارت */
export function CardExtras({ card }) {
    return (
        <>
            {card.replies.length > 0 && (
                <div className="replies">
                    {card.replies.map((r) => <ReplyItem key={r.id} text={r.text} />)}
                </div>
            )}
            {card.editing && (
                <div className="edit-bar">
                    <button type="button" className="btn btn-primary" onClick={() => card.endEdit(true)}>ذخیره</button>
                    <button type="button" className="btn btn-ghost" onClick={() => card.endEdit(false)}>انصراف</button>
                </div>
            )}
            {card.replyOpen && <ReplyForm card={card} />}
        </>
    );
}

