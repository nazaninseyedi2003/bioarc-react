import { toFa } from '../state';

const RICH_TAGS = {
  B: 'strong', STRONG: 'strong', I: 'em', EM: 'em', U: 'u',
  BLOCKQUOTE: 'blockquote', DIV: 'div', P: 'div', BR: 'br', IMG: 'img',
};

export function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(value) {
  return esc(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
    .replace(/(^|[\s(،؛:])_(.+?)_(?=$|[\s).،؛:!؟?])/g, '$1<em>$2</em>');
}

export function fbHtml(text) {
  return String(text || '').split('\n').flatMap((line) => {
    if (!line.trim()) return [];
    const image = /^\s*!\[([^\]]*)\]\((\.\/image\/[\w.\-]+)\)\s*$/.exec(line);
    if (image) return [`<img class="toolbar2-image" alt="${esc(image[1])}" src="${image[2]}">`];
    const quote = /^\s*>\s?(.*)$/.exec(line);
    return [quote
      ? `<blockquote class="fb-quote">${inline(quote[1])}</blockquote>`
      : `<div class="toolbar2-txt">${inline(line)}</div>`];
  }).join('');
}

function cleanInto(source, destination) {
  for (const node of source.childNodes) {
    if (node.nodeType === 3) {
      destination.appendChild(document.createTextNode(node.nodeValue));
      continue;
    }
    if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|NOSCRIPT)$/.test(node.nodeName)) continue;
    const tag = RICH_TAGS[node.nodeName];
    if (!tag) {
      cleanInto(node, destination);
      continue;
    }
    if (tag === 'img') {
      const sourceUrl = node.getAttribute('src') || '';
      if (/^\.\/image\/[\w.\-]+$/.test(sourceUrl)) {
        const image = document.createElement('img');
        image.setAttribute('src', sourceUrl);
        image.setAttribute('alt', node.getAttribute('alt') || '');
        destination.appendChild(image);
      }
      continue;
    }
    const element = document.createElement(tag);
    if (tag !== 'br') cleanInto(node, element);
    destination.appendChild(element);
  }
}

function cleanHtmlElement(html) {
  const body = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html').body;
  const output = document.createElement('div');
  cleanInto(body, output);
  return output;
}

export function cleanHtml(html) {
  return cleanHtmlElement(html).innerHTML;
}

export function richText(html) {
  const lines = [];
  let buffer = '';
  function flush(quote) {
    const text = buffer.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
    if (text) lines.push((quote ? '> ' : '') + text);
    buffer = '';
  }
  function walk(node, quote) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) buffer += child.nodeValue;
      else if (child.nodeName === 'BR') flush(quote);
      else if (child.nodeName === 'IMG') {
        flush(quote);
        lines.push(`![${child.getAttribute('alt') || ''}](${child.getAttribute('src')})`);
      } else if (child.nodeName === 'DIV' || child.nodeName === 'BLOCKQUOTE') {
        const nestedQuote = quote || child.nodeName === 'BLOCKQUOTE';
        flush(quote);
        walk(child, nestedQuote);
        flush(nestedQuote);
      } else walk(child, quote);
    }
  }
  walk(cleanHtmlElement(html), false);
  flush(false);
  return lines.join('\n');
}

export function richRender(html) {
  const source = cleanHtmlElement(html);
  const output = document.createElement('div');
  let buffer = null;
  for (const node of source.childNodes) {
    const block = node.nodeType === 1 && (node.nodeName === 'DIV' || node.nodeName === 'BLOCKQUOTE');
    if (!block) {
      if (node.nodeName === 'BR') { buffer = null; continue; }
      if (node.nodeName === 'IMG') { buffer = null; output.appendChild(node.cloneNode(true)); continue; }
      if (node.nodeType === 3 && !node.nodeValue.replace(/\u00a0/g, ' ').trim() && !buffer) continue;
      if (!buffer) {
        buffer = document.createElement('div');
        buffer.className = 'toolbar2-txt';
        output.appendChild(buffer);
      }
      buffer.appendChild(node.cloneNode(true));
      continue;
    }
    buffer = null;
    if (!node.textContent.replace(/\u00a0/g, ' ').trim() && !node.querySelector('img')) continue;
    const quote = node.nodeName === 'BLOCKQUOTE';
    const last = output.lastChild;
    const element = quote && last?.nodeName === 'BLOCKQUOTE'
      ? last : document.createElement(quote ? 'blockquote' : 'div');
    if (element === last) element.appendChild(document.createElement('br'));
    else {
      element.className = quote ? 'fb-quote' : 'toolbar2-txt';
      output.appendChild(element);
    }
    for (const child of node.childNodes) element.appendChild(child.cloneNode(true));
  }
  output.querySelectorAll('img').forEach((image) => image.classList.add('toolbar2-image'));
  return output.innerHTML;
}

export function itemHtml(item) {
  return item.html ? richRender(item.html) : fbHtml(item.text);
}

function within(element, node) {
  return Boolean(element && node && (element === node || element.contains(node)));
}

export function focusEditor(element) {
  if (!element) return;
  const selection = window.getSelection();
  if (selection?.rangeCount && within(element, selection.anchorNode)) {
    if (document.activeElement !== element) element.focus();
    return;
  }
  element.focus();
  if (selection && (!selection.rangeCount || !within(element, selection.anchorNode))) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function quoteElement(element) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !within(element, selection.anchorNode)) return null;
  const node = selection.anchorNode;
  const quote = (node.nodeType === 3 ? node.parentNode : node).closest('blockquote');
  return quote && within(element, quote) && quote !== element ? quote : null;
}

export function inQuote(element) {
  return Boolean(quoteElement(element));
}

export function applyCommand(element, name) {
  if (!element) return;
  focusEditor(element);
  try { document.execCommand('styleWithCSS', false, false); } catch { /* Browser support varies. */ }
  if (name === 'quote') {
    if (inQuote(element)) {
      if (!document.execCommand('outdent')) document.execCommand('formatBlock', false, 'div');
    } else document.execCommand('formatBlock', false, 'blockquote');
  } else document.execCommand(name, false, null);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

export function enterQuote(event, element) {
  if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
  const quote = quoteElement(element);
  if (quote && !quote.textContent.replace(/\u00a0/g, ' ').trim() && !quote.querySelector('img')) {
    event.preventDefault();
    applyCommand(element, 'quote');
  }
}

export function pastePlain(event, element, max = 2000) {
  event.preventDefault();
  const clipboard = event.clipboardData || event.nativeEvent?.clipboardData || window.clipboardData;
  const text = clipboard ? String(clipboard.getData('text') || '').replace(/\r/g, '') : '';
  const room = max - element.textContent.length + String(window.getSelection()).length;
  const allowed = text.slice(0, Math.max(0, room));
  if (!allowed) return;
  document.execCommand('insertHTML', false, allowed.split('\n').map(esc).join('<br>'));
}

export function fmtSize(number) {
  if (number < 1024) return `${toFa(number)} بایت`;
  if (number < 1048576) return `${toFa(Math.round(number / 1024))} کیلوبایت`;
  return `${toFa((number / 1048576).toFixed(1).replace('.', '٫'))} مگابایت`;
}

export function brief(text) {
  const one = String(text || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '[تصویر]')
    .replace(/^\s*>\s?/gm, '').replace(/(\*\*|\+\+)/g, '').replace(/\s+/g, ' ').trim();
  return one.length > 40 ? one.slice(0, 40) + '…' : one;
}

export function csvCell(value) {
  let text = String(value == null ? '' : value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
