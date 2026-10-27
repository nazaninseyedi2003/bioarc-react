import React, { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp, toFa } from '../state';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const text = (element, selector) => clean((selector ? element?.querySelector(selector) : element)?.textContent);
const ownText = element => clean(Array.from(element?.childNodes || []).filter(node => node.nodeType === 3).map(node => node.nodeValue).join(''));
const IGNORE = /[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;
const FOLD = { ي: 'ی', ى: 'ی', ك: 'ک', ة: 'ه', ۀ: 'ه', أ: 'ا', إ: 'ا', آ: 'ا', ٱ: 'ا', ؤ: 'و', ئ: 'ی' };
const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

export function normalizeSearchText(value) {
  const source = String(value ?? '');
  let s = '';
  const map = [];
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (IGNORE.test(character)) continue;
    const faIndex = FA.indexOf(character);
    const arIndex = AR.indexOf(character);
    const folded = faIndex >= 0 ? String(faIndex) : arIndex >= 0 ? String(arIndex) : FOLD[character] || character.toLowerCase();
    for (const next of folded) {
      s += next;
      map.push(index);
    }
  }
  return { s, map };
}

function entry(group, element, title, sub = '') {
  title = clean(title);
  sub = clean(sub);
  return { group, element, title, sub, t: normalizeSearchText(title), s: normalizeSearchText(sub) };
}

function documentSources() {
  const sources = [
    ['منو', Array.from(document.querySelectorAll('.menu > div:not(.search)')).map(element => entry('منو', element, text(element))).filter(item => item.title)],
    ['پرونده', [
      ...Array.from(document.querySelectorAll('.cardio-info')).map(element => entry('پرونده', element, text(element, '.cardio-type'), text(element, '.cardio-row'))),
      ...Array.from(document.querySelectorAll('.description-text')).map(element => entry('پرونده', element, text(element, '.description-txt1'), text(element, '.description-txt2'))),
      ...Array.from(document.querySelectorAll('.summary-details2 .summary-text')).map(element => entry('پرونده', element, 'خلاصه پرونده', text(element))),
    ]],
    ['مشخصات پرونده', Array.from(document.querySelectorAll('.grid-row .field-label')).flatMap(label => {
      let value = label.nextElementSibling;
      while (value && !value.matches('.field-value')) value = value.nextElementSibling;
      return value ? [entry('مشخصات پرونده', value, text(label).replace(/[:：]\s*$/, ''), text(value))] : [];
    })],
    ['بازخوردها', Array.from(document.querySelectorAll('.fb-new')).map(element => entry('بازخوردها', element, text(element, '.toolbar2-name'), text(element, '.fb-body')))],
    ['مقالات مرتبط', Array.from(document.querySelectorAll('#relatedArticles .article-item')).map(element => entry('مقالات مرتبط', element, text(element, '.text-sidebar3')))],
    ['آزمون‌ها', Array.from(document.querySelectorAll('.sidebar4 .exam-item')).map(element => {
      const title = element.querySelector('.icon-sidebar3');
      return entry('آزمون‌ها', element, ownText(title) || text(title));
    })],
    ['نظرات', Array.from(document.querySelectorAll('#commentList .part4-sidebar3-item')).map(element => entry('نظرات', element, text(element, '.part4-sidebar3-username'), text(element, '.part4-sidebar3-text')))],
    ['برچسب‌ها', Array.from(document.querySelectorAll('.tag-card [data-tag-id]')).map(element => entry('برچسب‌ها', element, ownText(element))).filter(item => item.title)],
  ];
  return sources;
}

export function searchDocument(query) {
  const words = normalizeSearchText(clean(query)).s.split(' ').filter(Boolean);
  if (!words.length) return null;
  const groups = [];
  for (const [group, entries] of documentSources()) {
    const matches = [];
    entries.forEach((item, order) => {
      let score = 0;
      const matchesAll = words.every(word => {
        const titleIndex = item.t.s.indexOf(word);
        const subIndex = item.s.s.indexOf(word);
        if (titleIndex === 0 || (titleIndex > 0 && item.t.s[titleIndex - 1] === ' ')) score += 3;
        else if (titleIndex >= 0) score += 2;
        else if (subIndex >= 0) score += 1;
        else return false;
        return true;
      });
      if (matchesAll) matches.push({ ...item, score, order });
    });
    matches.sort((a, b) => b.score - a.score || a.order - b.order);
    if (matches.length) groups.push({ group, total: matches.length, items: matches.slice(0, 8) });
  }
  return { words, groups };
}

function matchRanges(normalized, words) {
  const ranges = [];
  for (const word of words) {
    let from = 0;
    let index;
    while ((index = normalized.s.indexOf(word, from)) >= 0) {
      ranges.push([normalized.map[index], normalized.map[index + word.length - 1] + 1]);
      from = index + word.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

function Highlight({ value, normalized, words, windowSize = 0 }) {
  const ranges = matchRanges(normalized, words);
  let start = 0;
  let end = value.length;
  if (windowSize && value.length > windowSize) {
    start = Math.max(0, (ranges[0]?.[0] || 0) - Math.floor(windowSize / 3));
    end = Math.min(value.length, start + windowSize);
    start = Math.max(0, end - windowSize);
  }
  const children = [];
  let position = start;
  if (start > 0) children.push('…');
  for (const range of ranges) {
    const a = Math.max(range[0], start);
    const b = Math.min(range[1], end);
    if (b <= a) continue;
    if (a > position) children.push(value.slice(position, a));
    children.push(<mark key={`${a}-${b}`}>{value.slice(a, b)}</mark>);
    position = b;
  }
  if (position < end) children.push(value.slice(position, end));
  if (end < value.length) children.push('…');
  return children;
}

const tooltipRules = [
  ['.view-article', element => {
    const article = element.closest('.article-item');
    if (article) {
      const who = article.hasAttribute('data-user') ? 'شما' : text(article, '.name-tip strong');
      const date = clean(text(article, '.name-tip span').replace('تاریخ ثبت:', ''));
      const rows = [];
      if (who) rows.push(['ثبت‌کننده', who]);
      if (date) rows.push(['تاریخ ثبت', date]);
      rows.push(['پسندیدن', text(article, '.stat-badge[data-role="like"] > span') || '۰'], ['نظرات', text(article, '.stat-badge[data-role="comment"] > span') || '۰']);
      return { title: text(article, '.text-sidebar3'), body: 'برای مشاهدهٔ متن کامل مقاله کلیک کنید', rows };
    }
    const exam = element.closest('.exam-item');
    return { title: text(exam, '.icon-sidebar3'), body: 'برای شروع و مشاهدهٔ آزمون کلیک کنید', rows: [['نوع', exam?.getAttribute('data-kind') === 'person' ? 'ساختهٔ شما' : 'آزمون آماده']] };
  }],
  ['.menu > .search', () => ({ title: 'جستجو', body: 'جستجو در پرونده، بازخوردها، مقالات و منو (کلید /)' })],
  ['.add-article-btn', () => ({ title: 'مقالهٔ جدید', body: 'یک مقالهٔ مرتبط به پرونده اضافه کنید' })],
  ['.add-exam-btn', () => ({ title: 'آزمون جدید', body: 'یک آزمون خودارزیابی بسازید' })],
  ['.sidebar1-btn', () => ({ title: 'ویرایش برچسب‌ها', body: 'افزودن یا حذف برچسب' })],
  ['.smart-tag', () => ({ title: 'برچسب هوشمند', body: 'یک برچسب پیشنهادی اضافه می‌شود' })],
  ['.tag-remove', () => ({ title: 'حذف برچسب', body: 'با امکان بازگردانی' })],
  ['.stat-badge[data-role="like"]', () => ({ title: 'پسندیدن', body: 'کلیک دوباره لایک را برمی‌دارد' })],
  ['.stat-badge[data-role="dislike"]', () => ({ title: 'نپسندیدن', body: 'کلیک دوباره برمی‌دارد' })],
  ['.stat-badge[data-role="comment"]', () => ({ title: 'نظرات', body: 'رفتن به بخش نظر' })],
  ['.exam-del', () => ({ title: 'حذف آزمون', body: 'با امکان بازگردانی' })],
  ['.article-item .del-sidebar3', () => ({ title: 'حذف مقاله', body: 'با امکان بازگردانی' })],
  ['.part4-sidebar3-delete', () => ({ title: 'حذف نظر', body: 'با امکان بازگردانی' })],
  ['.part4-sidebar3-send-btn', () => ({ title: 'ارسال نظر', body: 'یا کلید Enter' })],
  ['.mention2-toolbar4', () => ({ title: 'پیوست فایل', body: 'حداکثر ۵ فایل، هرکدام تا ۱۰ مگابایت' })],
  ['.tb4-tag-lbl', () => ({ title: 'منشن', body: 'انتخاب افراد (یا تایپ @)' })],
  ['.tb4-tag-del', () => ({ title: 'حذف منشن' })],
  ['.fb-status, .status-badge', element => ({ title: 'وضعیت بازخورد', body: element.classList.contains('fb-status') ? 'برای تغییر وضعیت کلیک کنید' : '' })],
  ['.fb-file-del', () => ({ title: 'حذف فایل پیوست' })],
  ['.file-details1', element => ({ title: 'باز/بسته کردن بخش', body: element.classList.contains('is-collapsed') ? 'نمایش محتوا' : 'پنهان کردن محتوا' })],
  ['.icon-btn, .tb4-btn, .fb-reply, .fb-edit, .fb-del', () => ({})],
];
const TOOLTIP_SELECTOR = tooltipRules.map(([selector]) => selector).join(',');

function stealTitle(element) {
  const title = element.getAttribute('title');
  if (title) {
    element.setAttribute('data-pop-title', title);
    element.removeAttribute('title');
  }
}

function describeTooltip(element) {
  const rule = tooltipRules.find(([selector]) => element.matches(selector));
  const info = rule?.[1](element) || {};
  if (!info.title) info.title = element.getAttribute('data-pop-title') || element.getAttribute('aria-label') || '';
  return info;
}

function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.25 8.625C2.25 12.56 5.43997 15.75 9.375 15.75C13.31 15.75 16.5 12.56 16.5 8.625C16.5 4.68997 13.31 1.5 9.375 1.5C5.43997 1.5 2.25 4.68997 2.25 8.625Z" stroke="#36459B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.5 16.5L3 15" stroke="#36459B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export default function SearchAndTooltips() {
  const { state } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [active, setActive] = useState(-1);
  const [panelStyle, setPanelStyle] = useState({});
  const [listHeight, setListHeight] = useState(140);
  const [tooltip, setTooltip] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const popRef = useRef(null);
  const openRef = useRef(false);
  const itemsRef = useRef([]);
  const activeRef = useRef(-1);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const tooltipTarget = useRef(null);
  const hideTooltipRef = useRef(() => {});
  const timers = useRef(new Set());
  const focusRequested = useRef(false);

  const schedule = useCallback((callback, delay) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
    return timer;
  }, []);

  const placeSearch = useCallback(() => {
    const icon = document.querySelector('.menu > .search');
    if (!icon) return;
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const panelWidth = Math.min(560, width - 24);
    const menu = icon.parentElement.getBoundingClientRect();
    const top = Math.max(12, Math.min(menu.bottom + 6, height - 220));
    setPanelStyle({ width: panelWidth, top, left: Math.max(12, (width - panelWidth) / 2) });
    setListHeight(Math.max(140, height - top - 110));
  }, []);

  const openSearch = useCallback(() => {
    openRef.current = true;
    focusRequested.current = true;
    placeSearch();
    setIsOpen(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [placeSearch]);

  const closeSearch = useCallback((refocus = false) => {
    openRef.current = false;
    setIsOpen(false);
    if (refocus) document.querySelector('.menu > .search')?.focus();
  }, []);

  const choose = useCallback(index => {
    const result = itemsRef.current[index];
    if (!result?.element?.isConnected) return;
    closeSearch(false);
    window.dispatchEvent(new CustomEvent('bioarc:reveal', { detail: { element: result.element } }));
    // Check the controls after React commits the reveal event, avoiding two toggles.
    schedule(() => {
      if (result.element.closest('.fb-new')) {
        const firstTab = document.querySelector('.tabs-wrapper .tab-btn');
        if (firstTab && !firstTab.classList.contains('active')) firstTab.click();
      }
      document.querySelectorAll('.file-details1.is-collapsed').forEach(header => {
        const targets = header.classList.contains('flesh')
          ? Array.from(header.parentElement.children).filter(child => child.matches('.tabs-wrapper, .tab-content'))
          : [header.nextElementSibling];
        if (targets.some(target => target && (target === result.element || target.contains(result.element)))) header.click();
      });
    }, 40);
    schedule(() => {
      const element = result.element;
      if (!element.isConnected || !element.getClientRects().length) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      element.classList.remove('gs-flash');
      void element.offsetWidth;
      element.classList.add('gs-flash');
      schedule(() => element.classList.remove('gs-flash'), 2200);
    }, 300);
  }, [closeSearch, schedule]);

  useEffect(() => {
    if (!isOpen) return;
    const next = searchDocument(query);
    const items = next?.groups.flatMap(group => group.items) || [];
    itemsRef.current = items;
    activeRef.current = items.length ? 0 : -1;
    setResults(next);
    setActive(activeRef.current);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query, isOpen, state]);

  useLayoutEffect(() => {
    const icon = document.querySelector('.menu > .search');
    if (icon) {
      icon.classList.toggle('is-open', isOpen);
      icon.setAttribute('aria-expanded', String(isOpen));
    }
    if (isOpen && focusRequested.current) {
      focusRequested.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!tooltip?.measuring || !popRef.current || !tooltip.element.isConnected) return;
    const bounds = tooltip.element.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const popWidth = popRef.current.offsetWidth;
    const popHeight = popRef.current.offsetHeight;
    const above = bounds.top - popHeight - 10 >= 8;
    const top = above ? bounds.top - popHeight - 10 : Math.min(bounds.bottom + 10, height - popHeight - 8);
    const left = Math.max(8, Math.min(bounds.left + bounds.width / 2 - popWidth / 2, width - popWidth - 8));
    const arrow = Math.max(14, Math.min(bounds.left + bounds.width / 2 - left, popWidth - 14));
    setTooltip(current => ({ ...current, measuring: false, below: !above, style: { left, top, '--bx-arrow-x': `${arrow}px` } }));
  }, [tooltip?.info, tooltip?.element, tooltip?.measuring]);

  useEffect(() => {
    const icon = document.querySelector('.menu > .search');
    if (icon) {
      Object.entries({ role: 'button', tabindex: '0', 'aria-label': 'جستجو', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'gsPanel' }).forEach(([key, value]) => icon.setAttribute(key, value));
    }
    const click = event => {
      const search = event.target.closest?.('.menu > .search');
      if (search) {
        if (openRef.current) closeSearch(false);
        else openSearch();
      }
    };
    const keydown = event => {
      if (event.key === 'Escape' && openRef.current) {
        event.preventDefault();
        closeSearch(true);
        return;
      }
      const element = event.target;
      if (element.closest?.('.menu > .search') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        element.closest('.menu > .search').click();
        return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(element.nodeName) || element.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      } else if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === '/' || event.code === 'Slash')) {
        event.preventDefault();
        openSearch();
      }
    };
    const outside = event => {
      if (openRef.current && !event.target.closest?.('#gsPanel, .menu > .search')) closeSearch(false);
    };
    const resize = () => {
      if (openRef.current) placeSearch();
    };
    document.addEventListener('click', click);
    document.addEventListener('keydown', keydown);
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      window.removeEventListener('resize', resize);
      icon?.classList.remove('is-open');
    };
  }, [closeSearch, openSearch, placeSearch]);

  useEffect(() => {
    const softHide = () => {
      tooltipTarget.current?.removeAttribute('aria-describedby');
      tooltipTarget.current = null;
      setTooltip(current => current ? { ...current, open: false } : current);
    };
    const hide = () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      softHide();
    };
    hideTooltipRef.current = hide;
    const show = element => {
      if (!element?.isConnected) return;
      clearTimeout(hideTimer.current);
      stealTitle(element);
      const info = describeTooltip(element);
      if (!info.title && !info.body) return;
      if (tooltipTarget.current !== element) tooltipTarget.current?.removeAttribute('aria-describedby');
      tooltipTarget.current = element;
      element.setAttribute('aria-describedby', 'bxPop');
      setTooltip({ element, info, open: true, measuring: true, below: false, style: { left: 0, top: 0 } });
    };
    const over = event => {
      const element = event.target.closest?.(TOOLTIP_SELECTOR);
      if (!element) return;
      stealTitle(element);
      if (event.relatedTarget && element.contains(event.relatedTarget)) return;
      clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => show(element), 220);
    };
    const out = event => {
      const element = event.target.closest?.(TOOLTIP_SELECTOR);
      if (!element || (event.relatedTarget && element.contains(event.relatedTarget))) return;
      clearTimeout(showTimer.current);
      hideTimer.current = setTimeout(softHide, 80);
    };
    const focus = event => {
      const element = event.target.closest?.(TOOLTIP_SELECTOR);
      if (element) show(element);
    };
    const blur = event => {
      if (event.target.closest?.(TOOLTIP_SELECTOR)) hide();
    };
    const keydown = event => {
      if (event.key === 'Escape') hide();
    };
    const touch = event => {
      const element = event.target.closest?.(TOOLTIP_SELECTOR);
      if (!element) return;
      show(element);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, 1800);
    };
    const click = event => {
      const element = event.target.closest?.(TOOLTIP_SELECTOR);
      if (element && tooltipTarget.current === element) schedule(() => {
        if (tooltipTarget.current === element) show(element);
      }, 260);
    };
    document.querySelectorAll(TOOLTIP_SELECTOR).forEach(stealTitle);
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    document.addEventListener('keydown', keydown);
    document.addEventListener('touchstart', touch);
    document.addEventListener('click', click);
    window.addEventListener('scroll', hide);
    window.addEventListener('resize', hide);
    return () => {
      hide();
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', out);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('touchstart', touch);
      document.removeEventListener('click', click);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('resize', hide);
    };
  }, [schedule]);

  useEffect(() => () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
  }, []);

  const activate = (index, scroll = false) => {
    const count = itemsRef.current.length;
    const next = index >= 0 && index < count ? index : -1;
    activeRef.current = next;
    setActive(next);
    if (scroll && next >= 0) document.getElementById(`gsOpt${next}`)?.scrollIntoView({ block: 'nearest' });
  };

  const onSearchKeyDown = event => {
    const count = itemsRef.current.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (count) activate((activeRef.current + 1) % count, true);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (count) activate((activeRef.current - 1 + count) % count, true);
    } else if (event.key === 'Home' && count && event.ctrlKey) {
      event.preventDefault();
      activate(0, true);
    } else if (event.key === 'End' && count && event.ctrlKey) {
      event.preventDefault();
      activate(count - 1, true);
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (count) choose(activeRef.current >= 0 ? activeRef.current : 0);
    }
  };

  const total = results?.groups.reduce((sum, group) => sum + group.total, 0) || 0;
  let optionIndex = 0;
  return createPortal(<>
    <div className={`gs-panel${isOpen ? ' is-open' : ''}`} id="gsPanel" role="dialog" aria-label="جستجو" dir="rtl" style={panelStyle}>
      <div className="gs-field">
        <span className="gs-field-ic" aria-hidden="true"><SearchIcon /></span>
        <input ref={inputRef} type="text" className="gs-input" id="gsInput" autoComplete="off" spellCheck={false} inputMode="search" enterKeyHint="search" placeholder="جستجو در پرونده، بازخوردها، مقالات…" aria-label="عبارت جستجو" role="combobox" aria-expanded={isOpen} aria-controls="gsList" aria-autocomplete="list" aria-activedescendant={isOpen && active >= 0 ? `gsOpt${active}` : undefined} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onSearchKeyDown} />
        <button type="button" className="gs-clear" aria-label="پاک کردن عبارت" hidden={!query} onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(''); inputRef.current?.focus(); }}>×</button>
      </div>
      <ul ref={listRef} className="gs-list" id="gsList" role="listbox" aria-label="نتایج جستجو" style={{ maxHeight: listHeight }}>
        {!results && <li className="gs-hint" role="presentation">عبارتی را وارد کنید تا در پرونده جستجو شود.</li>}
        {results && !total && <li className="gs-hint" role="presentation">نتیجه‌ای برای «{clean(query)}» پیدا نشد.</li>}
        {results?.groups.map(group => <Fragment key={group.group}>
          <li className="gs-group" role="presentation">{group.group}<span className="gs-count">{toFa(group.total)}</span></li>
          {group.items.map(result => {
            const index = optionIndex++;
            return <li key={index} className={`gs-item${active === index ? ' is-active' : ''}`} role="option" aria-selected={active === index} id={`gsOpt${index}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)} onMouseMove={() => { if (activeRef.current !== index) activate(index); }}>
              <span className="gs-title"><Highlight value={result.title} normalized={result.t} words={results.words} /></span>
              {result.sub && <span className="gs-sub"><Highlight value={result.sub} normalized={result.s} words={results.words} windowSize={80} /></span>}
            </li>;
          })}
        </Fragment>)}
      </ul>
      <div className="gs-foot"><span className="gs-status" role="status" aria-live="polite">{results ? total ? `${toFa(total)} نتیجه` : 'نتیجه‌ای پیدا نشد' : ''}</span><span className="gs-keys" aria-hidden="true">↑ ↓ حرکت · Enter انتخاب · Esc بستن</span></div>
    </div>
    <div ref={popRef} className={`bx-pop${tooltip?.info.rows?.length ? ' is-rich' : ''}${tooltip?.open ? ' is-open' : ''}${tooltip?.measuring ? ' is-measuring' : ''}${tooltip?.below ? ' is-below' : ''}`} role="tooltip" id="bxPop" dir="rtl" style={tooltip?.style} onMouseEnter={() => clearTimeout(hideTimer.current)} onMouseLeave={() => hideTooltipRef.current()}>
      {tooltip?.info.title && <div className="bx-pop-title">{tooltip.info.title}</div>}
      {tooltip?.info.body && <div className="bx-pop-body">{tooltip.info.body}</div>}
      {!!tooltip?.info.rows?.length && <dl className="bx-pop-rows">{tooltip.info.rows.map(([label, value], index) => <Fragment key={index}><dt>{label}</dt><dd>{value}</dd></Fragment>)}</dl>}
      <span className="bx-pop-arrow" />
    </div>
  </>, document.body);
}
