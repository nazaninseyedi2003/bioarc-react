import useCard from '../hooks/useCard.js';
import { CardExtras, EditableText } from './CardParts.jsx';
import {
    DeleteIcon, EditIconAlt, ReplyIcon, ToolbarUserAvatar, MentionAvatarAlt,
} from './icons.jsx';
import { TXT_CONFIRMED, TXT_UNCONFIRMED } from '../utils.js';
import { AVATAR_SRC } from '../initialData.js';

/* کارت متنی (با عکس) — بازخوردهای متنیِ جدید هم با همین کارت ساخته می‌شوند */
export default function TextCard({ item }) {
    const card = useCard(item);
    const confirmed = item.status === 'confirmed';

    return (
        <div
            ref={card.ref}
            className={'feedback-toolbar2' + (item.isNew ? ' is-new' : '') + (card.editing ? ' is-editing' : '')}
        >
            {/* هدر Toolbar2 */}
            <div className="toolbar2-header">
                {/* سمت راست: کاربر */}
                <div className="toolbar2-user">
                    <span className="toolbar2-user-name">
                        {item.isNew
                            ? <img className="user-avatar" src={AVATAR_SRC} alt="" />
                            : <ToolbarUserAvatar />}
                        <span className="toolbar2-name">{item.userName}</span>
                    </span>
                </div>

                {/* سمت چپ: ابزارها */}
                <div className="toolbar2-actions">
                    <div className="action-icons">
                        <button type="button" className="icon-btn" title="حذف" aria-label="حذف" onClick={card.remove}>
                            <DeleteIcon />
                        </button>
                        <button type="button" className="icon-btn" title="ویرایش" aria-label="ویرایش" onClick={card.startEdit}>
                            <EditIconAlt />
                        </button>
                        <button type="button" className="icon-btn" title="پاسخ" aria-label="پاسخ" onClick={card.toggleReply}>
                            <ReplyIcon />
                        </button>
                    </div>

                    {/* وضعیت */}
                    <div className={'status-badge ' + (confirmed ? 'badge-green' : 'badge-red')} onClick={card.toggle}>
                        <span className="white-dot" />
                        <span>{confirmed ? TXT_CONFIRMED : TXT_UNCONFIRMED}</span>
                    </div>

                    {/* منشن (فقط در کارت اولیه) */}
                    {!item.isNew && (
                        <div className="mention-section">
                            <span className="at-sign">@</span>
                            <div className="avatar-group">
                                <MentionAvatarAlt />
                                <img src={AVATAR_SRC} alt="عکس منشن" className="avatar-circle-img" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* خط جداکننده */}
            <hr className="line-divider3" />
            {item.blocks.map((b, i) => (
                b.type === 'image'
                    ? <img key={i} src={b.src} alt="nature-image" className="toolbar2-image" />
                    : (
                        <EditableText
                            key={i}
                            className="toolbar2-txt"
                            text={b.text}
                            editing={card.editing}
                            index={card.textIndexes.indexOf(i)}
                            card={card}
                        />
                    )
            ))}

            <CardExtras card={card} />
        </div>
    );
}
