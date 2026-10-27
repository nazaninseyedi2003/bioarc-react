import useCard from '../hooks/useCard.js';
import { CardExtras, EditableText } from './CardParts.jsx';
import {
    DeleteIcon, EditIcon, ReplyIcon, ReplyUserIcon, MentionAvatar,
} from './icons.jsx';
import { TXT_CONFIRMED, TXT_UNCONFIRMED } from '../utils.js';
import { AVATAR_SRC } from '../initialData.js';

/* کارت اول: بازخورد همراه با «پاسخ به» */
export default function FeedbackCard({ item }) {
    const card = useCard(item);
    const confirmed = item.status === 'confirmed';

    return (
        <div
            ref={card.ref}
            className={'feedback-card' + (item.isNew ? ' is-new' : '') + (card.editing ? ' is-editing' : '')}
        >
            {/* کانتینر کلی بخش پاسخ */}
            <div className="reply-wrapper">
                <span className="reply-badge">پاسخ به:</span>
                <div className="reply-banner">
                    <div className="reply-user">
                        <span className="avatar-circle green-bg">
                            <ReplyUserIcon />
                        </span>
                        <span>{item.replyTo.user}</span>
                    </div>
                    <span className="reply-text">{item.replyTo.text}</span>
                </div>
            </div>

            <hr className="line-divider" />

            <div className="card-body">
                {/* سمت راست: پروفایل کاربر */}
                <div className="user-info">
                    <img src={AVATAR_SRC} alt="ستایش قبادی" className="user-avatar" />
                    <span className="user-name">{item.userName}</span>
                </div>

                {/* سمت چپ: آیکون‌ها، وضعیت و منشن */}
                <div className="user-bar-left">
                    <div className="action-icons">
                        <button type="button" className="icon-btn" title="حذف" aria-label="حذف" onClick={card.remove}>
                            <DeleteIcon />
                        </button>
                        <button type="button" className="icon-btn" title="ویرایش" aria-label="ویرایش" onClick={card.startEdit}>
                            <EditIcon />
                        </button>
                        <button type="button" className="icon-btn" title="پاسخ" aria-label="پاسخ" onClick={card.toggleReply}>
                            <ReplyIcon />
                        </button>
                    </div>

                    {/* بج وضعیت */}
                    <div className={'status-badge ' + (confirmed ? 'badge-green' : 'badge-red')} onClick={card.toggle}>
                        <span className="white-dot" />
                        <span>{confirmed ? TXT_CONFIRMED : TXT_UNCONFIRMED}</span>
                    </div>

                    <div className="mention-section">
                        <span className="at-sign">@</span>
                        <div className="avatar-group">
                            <MentionAvatar />
                            <img src={AVATAR_SRC} alt="عکس منشن" className="avatar-circle-img" />
                        </div>
                    </div>
                </div>
                <hr className="line-divider line-divider1" />
                <div className="user-mention">
                    {item.blocks.map((b, i) => (
                        <EditableText
                            key={i}
                            as="span"
                            text={b.text}
                            editing={card.editing}
                            index={card.textIndexes.indexOf(i)}
                            card={card}
                        />
                    ))}
                </div>
            </div>

            <CardExtras card={card} />
        </div>
    );
}
