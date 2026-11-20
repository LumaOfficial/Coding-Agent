/* Orbit's hands in the page: a visible cursor, real clicks, real typing.
   Injected on demand by the background worker only after the user approved
   the action in Orbit's chat. */

(() => {
  if (window.__orbitContent) return;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

  const CANDIDATES =
    'a,button,input,textarea,select,[role="button"],[role="link"],[role="checkbox"],[role="tab"],[contenteditable="true"],[type="submit"]';

  const STYLE = `
    #orbit-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform .3s cubic-bezier(.22,.68,0,1);will-change:transform;transform:translate(-60px,-60px)}
    #orbit-cursor svg{display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
    #orbit-cursor .orbit-cursor-label{position:absolute;left:16px;top:18px;background:linear-gradient(135deg,#8b6cff,#6f8cff);color:#fff;font:600 11px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;padding:3px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 6px 16px rgba(0,0,0,.35)}
    .orbit-ripple{position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid rgba(139,108,255,.9);z-index:2147483646;pointer-events:none;animation:orbit-ripple .55s ease-out forwards}
    @keyframes orbit-ripple{from{transform:scale(.4);opacity:.9}to{transform:scale(2.2);opacity:0}}
  `;

  let cursor = null;
  let label = null;
  let hideTimer = 0;
  const refs = [];

  function ensureStyle() {
    if (document.getElementById('orbit-style')) return;
    const style = document.createElement('style');
    style.id = 'orbit-style';
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureCursor() {
    if (cursor && document.contains(cursor)) return cursor;
    ensureStyle();
    cursor = document.createElement('div');
    cursor.id = 'orbit-cursor';
    cursor.innerHTML =
      '<svg width="22" height="26" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 1.5L19 12.2L11.4 13.6L15.6 22.3L12.2 24L8 15.2L2 21V1.5Z" fill="#8b6cff" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>' +
      '</svg><span class="orbit-cursor-label">Orbit</span>';
    label = cursor.querySelector('.orbit-cursor-label');
    document.documentElement.appendChild(cursor);
    return cursor;
  }

  function showLabel(text) {
    ensureCursor();
    label.textContent = text || 'Orbit';
    cursor.style.opacity = '1';
  }

  function hideSoon(delay = 2200) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (cursor) cursor.style.opacity = '0';
    }, delay);
  }

  async function moveCursor(x, y, { instant = false } = {}) {
    ensureCursor();
    if (instant) {
      cursor.style.transition = 'none';
      cursor.style.transform = `translate(${x}px, ${y}px)`;
      cursor.style.opacity = '1';
      void cursor.offsetWidth;
      cursor.style.transition = '';
      return;
    }
    showLabel('Orbit');
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    await sleep(320);
  }

  function ripple(x, y) {
    ensureStyle();
    const dot = document.createElement('div');
    dot.className = 'orbit-ripple';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    document.documentElement.appendChild(dot);
    setTimeout(() => dot.remove(), 700);
  }

  function describe(el) {
    if (!el) return 'element';
    const text = normalize(
      el.innerText ||
        el.value ||
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.id
    );
    return text ? `"${text.slice(0, 60)}"` : `<${el.tagName.toLowerCase()}>`;
  }

  function resolve(params = {}) {
    if (params.selector) {
      try {
        const found = document.querySelector(params.selector);
        if (found) return found;
      } catch {
        /* invalid selector — fall through */
      }
    }
    if (Number.isInteger(params.index) && refs[params.index]) return refs[params.index];

    const want = normalize(params.text || params.label);
    if (!want) return null;
    const all = [...document.querySelectorAll(CANDIDATES)];
    const read = (el) =>
      normalize(
        el.innerText ||
          el.value ||
          el.getAttribute('aria-label') ||
          el.getAttribute('placeholder') ||
          el.getAttribute('name') ||
          el.id
      );
    return all.find((el) => read(el) === want) || all.find((el) => read(el).includes(want)) || null;
  }

  function visible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
  }

  function snapshot(maxText) {
    const items = [...document.querySelectorAll(CANDIDATES)].filter(visible).slice(0, 60);
    refs.length = 0;
    items.forEach((el, i) => {
      refs[i] = el;
    });

    const rows = items.map((el, i) => {
      const kind = el.tagName.toLowerCase();
      const name =
        el.innerText ||
        el.value ||
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.id ||
        '';
      return `[${i}] ${kind} ${normalize(name).slice(0, 70)}${el.disabled ? ' (disabled)' : ''}`;
    });

    const text = normalize(document.body?.innerText || '').slice(0, maxText || 4000);

    return {
      text: [
        `Title: ${document.title}`,
        `URL: ${location.href}`,
        '',
        `Interactive elements (${rows.length}):`,
        ...rows,
        '',
        'Visible text:',
        text,
      ].join('\n'),
      url: location.href,
      title: document.title,
    };
  }

  async function click(params) {
    const el = resolve(params);
    if (!el) throw new Error('Could not find that element on the page. Take a snapshot first.');
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    await sleep(260);

    const rect = el.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    await moveCursor(x, y);
    showLabel(`Click ${describe(el)}`);
    ripple(x, y);
    await sleep(120);

    const target = document.elementFromPoint(x, y) || el;
    const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
    try {
      target.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerId: 1 }));
      target.dispatchEvent(new MouseEvent('mousedown', base));
      target.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerId: 1 }));
      target.dispatchEvent(new MouseEvent('mouseup', base));
    } catch {
      /* older pages without PointerEvent */
    }
    if (typeof target.click === 'function') target.click();
    else target.dispatchEvent(new MouseEvent('click', base));

    await sleep(400);
    hideSoon();
    return { text: `Clicked ${describe(el)}.`, url: location.href, title: document.title };
  }

  function setFieldValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  async function type(params) {
    const el =
      resolve({ selector: params.selector, label: params.label, index: params.index }) ||
      (document.activeElement !== document.body ? document.activeElement : null);
    if (!el) throw new Error('No field found — take a snapshot and point at the input.');

    el.focus();
    const isField = 'value' in el && typeof el.value === 'string';
    const editable = isField || el.isContentEditable;
    if (!editable) throw new Error('That element does not accept text.');

    if (isField && params.clear !== false) {
      setFieldValue(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const rect = el.getBoundingClientRect();
    await moveCursor(
      Math.round(rect.left + Math.min(rect.width / 2, 120)),
      Math.round(rect.top + rect.height / 2)
    );
    showLabel('Typing…');

    const text = String(params.text ?? '').slice(0, 400);
    for (const char of text) {
      if (isField) setFieldValue(el, `${el.value}${char}`);
      else document.execCommand('insertText', false, char);
      el.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' })
      );
      await sleep(26);
    }

    if (params.enter) {
      await sleep(120);
      pressKey('Enter', {});
    }

    hideSoon();
    return {
      text: `Typed ${text.length} character${text.length === 1 ? '' : 's'} into ${describe(el)}.`,
      url: location.href,
      title: document.title,
    };
  }

  function pressKey(key, mods = {}) {
    const target = document.activeElement || document.body;
    const init = {
      key,
      code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
      bubbles: true,
      cancelable: true,
      ctrlKey: Boolean(mods.ctrl),
      shiftKey: Boolean(mods.shift),
      altKey: Boolean(mods.alt),
      metaKey: Boolean(mods.ctrl) && navigator.platform.includes('Mac'),
    };
    target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keypress', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
    if (key === 'Enter' && target.form && typeof target.form.requestSubmit === 'function') {
      // let the page handle it; requestSubmit only when nothing else did
    }
  }

  async function key(params) {
    pressKey(String(params.key || 'Enter'), params);
    await sleep(250);
    hideSoon();
    return {
      text: `Pressed ${params.ctrl ? 'Ctrl+' : ''}${params.shift ? 'Shift+' : ''}${params.key}.`,
      url: location.href,
      title: document.title,
    };
  }

  async function scroll(params) {
    const direction = params.direction || 'down';
    const amount = Number(params.amount) || 700;
    const centerX = Math.round(window.innerWidth / 2);
    await moveCursor(centerX, Math.round(window.innerHeight / 2), { instant: true });
    showLabel(`Scrolling ${direction}`);
    if (direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (direction === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    else window.scrollBy({ top: direction === 'up' ? -amount : amount, behavior: 'smooth' });
    await sleep(600);
    hideSoon();
    return { text: `Scrolled ${direction}.`, url: location.href, title: document.title };
  }

  async function handle(action, params = {}) {
    switch (action) {
      case 'snapshot':
        return snapshot(params.max_text);
      case 'click':
        return click(params);
      case 'type':
        return type(params);
      case 'key':
        return key(params);
      case 'scroll':
        return scroll(params);
      default:
        throw new Error(`Unknown browser action: ${action}`);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'orbit:action') return undefined;
    handle(message.action, message.params || {})
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: error.message || 'The page blocked that action.' }));
    return true;
  });

  window.__orbitContent = { handle };
})();
