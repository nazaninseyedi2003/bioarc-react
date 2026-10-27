import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import seed from './templates/seed.json';

const STORAGE_KEY = 'bioarc_sidebar_v2_state';
const AppContext = createContext(null);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string';
export const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const toFa = value => String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[digit]);
export function toInt(value) {
  const result = String(value ?? '').replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)).replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)).replace(/[^\d]/g, '');
  return parseInt(result, 10) || 0;
}
export function shamsi(ts) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', {year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(ts)).replace(/[\u200e\u200f]/g, '');
}
export function timeAgo(ts) {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return 'همین الان';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return toFa(minutes) + ' دقیقه پیش';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return toFa(hours) + ' ساعت پیش';
  const days = Math.floor(hours / 24);
  if (days < 7) return toFa(days) + ' روز پیش';
  const weeks = Math.floor(days / 7);
  return weeks < 5 ? toFa(weeks) + ' هفته پیش' : shamsi(ts);
}

function initialState() {
  let state = {};
  try {
    state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    ['likeState', 'deletedComments', 'newComments'].forEach(key => localStorage.removeItem('task2b_sidebar_' + key));
  } catch { /* Storage can be unavailable in private browser contexts. */ }
  if (!object(state)) state = {};
  for (const key of ['t1', 't2', 'articles', 'comments', 'exams']) {
    const section = object(state[key]) ? state[key] : {};
    section.removed = (Array.isArray(section.removed) ? section.removed : []).filter(string);
    section.added = (Array.isArray(section.added) ? section.added : []).filter(item => object(item) && string(item.id) && !section.removed.includes(item.id));
    state[key] = section;
  }
  if (!object(state.votes)) state.votes = {};
  if (!object(state.cmt)) state.cmt = {};
  if (!string(state.draft)) delete state.draft;
  state.feedbacks = (Array.isArray(state.feedbacks) ? state.feedbacks : []).filter(item => object(item) && string(item.id)).map(item => ({
    ...item, author: string(item.author) ? item.author : '', text: string(item.text) ? item.text : '',
    html: string(item.html) ? item.html : undefined, ts: +item.ts || 0, approved: !!item.approved,
    mentions: (Array.isArray(item.mentions) ? item.mentions : []).filter(string),
    files: (Array.isArray(item.files) ? item.files : []).filter(file => object(file) && string(file.name)).map(file => ({...file,size:+file.size || 0})),
    replyTo: object(item.replyTo) && ['id','author','text'].every(key => string(item.replyTo[key])) ? item.replyTo : undefined,
  }));
  state.logs = (Array.isArray(state.logs) ? state.logs : []).filter(object).map(log => ({text: string(log.text) ? log.text : '', user: string(log.user) ? log.user : '', ts:+log.ts || 0}));
  if (!state.seedDone) { state.feedbacks.unshift(structuredClone(seed)); state.seedDone = true; }
  return state;
}

export function AppProvider({children}) {
  const [state, setState] = useState(initialState);
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());
  const update = useCallback(recipe => setState(previous => {
    const next = structuredClone(previous);
    recipe(next);
    return next;
  }), []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Keep working in memory. */ } }, [state]);
  useEffect(() => {
    window.BioarcSidebar = { reset() { try {localStorage.removeItem(STORAGE_KEY);} catch {} window.location.reload(); } };
    return () => { delete window.BioarcSidebar; timers.current.forEach(clearTimeout); };
  }, []);
  const toast = useCallback((message, actionLabel, onAction) => {
    const id = uid();
    setToasts(previous => [...previous.slice(-2), {id, message, actionLabel, onAction, show:false}]);
    const later = (callback, delay) => {
      const timer = setTimeout(() => {timers.current.delete(timer);callback();}, delay);
      timers.current.add(timer);
    };
    later(() => setToasts(previous => previous.map(item => item.id === id ? {...item, show:true} : item)), 10);
    later(() => setToasts(previous => previous.map(item => item.id === id ? {...item, show:false} : item)), 6000);
    later(() => setToasts(previous => previous.filter(item => item.id !== id)), 6220);
  }, []);
  return <AppContext.Provider value={{state, update, toast}}>
    {children}
    <div className="sb-toast-wrap" aria-live="polite">
      {toasts.map(item => <div key={item.id} className={'sb-toast' + (item.show ? ' show' : '')} role="status">
        <span className="sb-toast-msg">{item.message}</span>
        {item.actionLabel && <button type="button" className="sb-toast-action" onClick={() => {
          setToasts(previous => previous.filter(toast => toast.id !== item.id));
          item.onAction?.();
        }}>{item.actionLabel}</button>}
      </div>)}
    </div>
  </AppContext.Provider>;
}
export const useApp = () => useContext(AppContext);
