import { Fragment } from 'react';

// بازخوردهای ثبت‌شده (ماندگار بعد از رفرش)
export default function History({ items, onRemove }) {
  return (
    <section className="history" id="history" aria-labelledby="historyTitle" hidden={!items.length}>
      <h2 className="history-title" id="historyTitle">بازخوردهای ثبت‌شده</h2>
      <ul className="history-list" id="historyList">
        {items.map((r) => (
          <li className="history-item" data-id={r.id} key={r.id}>
            <div className="history-meta">
              <span>{r.type === 'voice' ? 'بازخورد صوتی' : 'بازخورد متنی'}</span>
              <span>{r.when}</span>
              <button type="button" className="history-remove" onClick={() => onRemove(r.id)}>
                حذف
              </button>
            </div>
            {r.type === 'voice' && r.audioUrl ? (
              <audio controls src={r.audioUrl}></audio>
            ) : (
              <div className="history-body" dangerouslySetInnerHTML={{ __html: r.safeHtml }} />
            )}
            {r.mentionNames.length > 0 && (
              <p className="history-extra">{'منشن: ' + r.mentionNames.join('، ')}</p>
            )}
            {r.files.length > 0 && (
              <p className="history-extra">
                پیوست:{' '}
                {r.files.map((f, i) => (
                  <Fragment key={i}>
                    {i > 0 && '، '}
                    <a href={f.url} download={f.name}>{f.name}</a>
                  </Fragment>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
