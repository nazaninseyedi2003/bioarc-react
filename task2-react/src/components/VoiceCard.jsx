import useCard from '../hooks/useCard.js';
import { CardExtras, EditableText } from './CardParts.jsx';
import AudioPlayer from './AudioPlayer.jsx';
import { TimerIcon, VoiceToolbarIcons } from './icons.jsx';
import { TXT_CONFIRMED, TXT_UNCONFIRMED } from '../utils.js';
import { AVATAR_SRC } from '../initialData.js';

/* کارت ویس */
export default function VoiceCard({ item }) {
    const card = useCard(item);
    const confirmed = item.status === 'confirmed';

    // آیکون‌های این کارت یک SVG واحد هستند؛ با موقعیت کلیک تشخیص می‌دهیم کدام آیکون است
    const onIconsClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width; // 0..1 از چپ
        if (x < 0.33) { card.remove(); }
        else if (x < 0.66) { card.startEdit(); }
        else { card.toggleReply(); }
    };

    return (
        <div
            ref={card.ref}
            className={'feedback-toolbar3' + (item.isNew ? ' is-new' : '') + (card.editing ? ' is-editing' : '')}
        >
            <div className="toolbar-top">
                <div className="user-toolbar3">
                    <div className="user-info">
                        <img src={AVATAR_SRC} alt={item.userName} className="user-avatar" />
                        <span className="user-name">{item.userName}</span>
                    </div>
                </div>

                <div className="icon-toolbar3">
                    <VoiceToolbarIcons onClick={onIconsClick} />

                    <div className={'status-toolbar3' + (confirmed ? '' : ' is-unconfirmed')} onClick={card.toggle}>
                        <span className="circle-status" />
                        <span>{confirmed ? TXT_CONFIRMED : TXT_UNCONFIRMED}</span>
                    </div>

                    <div className="timer-toolbar3">
                        <span>
                            <TimerIcon />
                        </span>
                        <span>{item.timeText}</span>
                    </div>
                </div>
            </div>

            <div className="toolbar-divider" />

            <AudioPlayer item={item} />

            {item.blocks.map((b, i) => (
                <EditableText
                    key={i}
                    className="toolbar2-txt"
                    text={b.text}
                    editing={card.editing}
                    index={card.textIndexes.indexOf(i)}
                    card={card}
                />
            ))}

            <CardExtras card={card} />
        </div>
    );
}
