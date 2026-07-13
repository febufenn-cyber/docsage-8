import {
  buildAnswerRequest,
  normalizeAnswerPayload,
  normalizeEndpoint,
  normalizePublicError,
  normalizeWidgetConfig
} from './contracts.mjs';

const CSS = `
:host {
  --docsage-accent: #315efb;
  --docsage-accent-contrast: #ffffff;
  --docsage-bg: #ffffff;
  --docsage-panel: #ffffff;
  --docsage-text: #172033;
  --docsage-muted: #667085;
  --docsage-border: #d0d5dd;
  --docsage-user: #eef2ff;
  --docsage-assistant: #f8fafc;
  --docsage-danger: #b42318;
  --docsage-radius: 16px;
  --docsage-shadow: 0 20px 48px rgba(16, 24, 40, 0.22);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--docsage-text);
}
:host([theme="dark"]), :host([data-theme="dark"]) {
  --docsage-bg: #101828;
  --docsage-panel: #101828;
  --docsage-text: #f2f4f7;
  --docsage-muted: #98a2b3;
  --docsage-border: #344054;
  --docsage-user: #1d2939;
  --docsage-assistant: #182230;
  --docsage-shadow: 0 20px 48px rgba(0, 0, 0, 0.48);
}
@media (prefers-color-scheme: dark) {
  :host([theme="auto"]), :host(:not([theme])) {
    --docsage-bg: #101828;
    --docsage-panel: #101828;
    --docsage-text: #f2f4f7;
    --docsage-muted: #98a2b3;
    --docsage-border: #344054;
    --docsage-user: #1d2939;
    --docsage-assistant: #182230;
    --docsage-shadow: 0 20px 48px rgba(0, 0, 0, 0.48);
  }
}
* { box-sizing: border-box; }
button, textarea { font: inherit; }
.launcher {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2147483000;
  min-width: 56px;
  min-height: 56px;
  border: 0;
  border-radius: 999px;
  padding: 0 18px;
  color: var(--docsage-accent-contrast);
  background: var(--docsage-accent);
  box-shadow: var(--docsage-shadow);
  cursor: pointer;
  font-weight: 700;
}
:host([position="left"]) .launcher { left: 24px; right: auto; }
.launcher:focus-visible, button:focus-visible, textarea:focus-visible, a:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--docsage-accent) 55%, white);
  outline-offset: 2px;
}
.panel {
  position: fixed;
  right: 24px;
  bottom: 92px;
  z-index: 2147483000;
  width: min(390px, calc(100vw - 32px));
  height: min(620px, calc(100vh - 124px));
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
  border: 1px solid var(--docsage-border);
  border-radius: var(--docsage-radius);
  background: var(--docsage-panel);
  box-shadow: var(--docsage-shadow);
}
:host([position="left"]) .panel { left: 24px; right: auto; }
.panel[hidden] { display: none; }
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--docsage-border);
}
.title { margin: 0; font-size: 16px; line-height: 1.35; }
.close {
  width: 36px;
  height: 36px;
  border: 1px solid var(--docsage-border);
  border-radius: 10px;
  color: var(--docsage-text);
  background: transparent;
  cursor: pointer;
}
.messages {
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overscroll-behavior: contain;
}
.message {
  max-width: 92%;
  border-radius: 14px;
  padding: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.message.user { align-self: flex-end; background: var(--docsage-user); }
.message.assistant { align-self: flex-start; background: var(--docsage-assistant); }
.message.error { border: 1px solid color-mix(in srgb, var(--docsage-danger) 45%, transparent); color: var(--docsage-danger); }
.answer { margin: 8px 0 0; white-space: pre-wrap; }
.state {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--docsage-border);
  border-radius: 999px;
  padding: 3px 8px;
  color: var(--docsage-muted);
  font-size: 12px;
  font-weight: 650;
}
.citations { margin: 12px 0 0; padding-left: 20px; }
.citations li + li { margin-top: 6px; }
.citations a { color: var(--docsage-accent); }
.form {
  border-top: 1px solid var(--docsage-border);
  padding: 12px;
  background: var(--docsage-bg);
}
.row { display: flex; align-items: flex-end; gap: 8px; }
.question {
  flex: 1;
  min-height: 46px;
  max-height: 140px;
  resize: vertical;
  border: 1px solid var(--docsage-border);
  border-radius: 12px;
  padding: 10px 12px;
  color: var(--docsage-text);
  background: var(--docsage-panel);
}
.send {
  min-width: 72px;
  min-height: 46px;
  border: 0;
  border-radius: 12px;
  color: var(--docsage-accent-contrast);
  background: var(--docsage-accent);
  cursor: pointer;
  font-weight: 700;
}
.send:disabled { cursor: wait; opacity: 0.65; }
.status { min-height: 18px; margin: 6px 2px 0; color: var(--docsage-muted); font-size: 12px; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 520px) {
  .panel { right: 16px; bottom: 84px; width: calc(100vw - 32px); height: min(70vh, 620px); }
  .launcher { right: 16px; bottom: 16px; }
  :host([position="left"]) .panel { left: 16px; right: auto; }
  :host([position="left"]) .launcher { left: 16px; right: auto; }
}
@media (prefers-reduced-motion: no-preference) {
  .panel { animation: docsage-in 140ms ease-out; }
  @keyframes docsage-in { from { opacity: 0; transform: translateY(8px); } }
}
`;

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  return node;
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

export class DocSageWidget extends HTMLElement {
  static observedAttributes = ['endpoint', 'token', 'title', 'theme', 'position'];

  constructor() {
    super();
    this._connected = false;
    this._busy = false;
    this._controller = null;
    this._config = normalizeWidgetConfig();
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this._renderShell();
    this._loadConfig();
  }

  disconnectedCallback() {
    this._controller?.abort();
  }

  attributeChangedCallback(name) {
    if (!this._connected) return;
    if (name === 'title' && this._title) this._title.textContent = this.getAttribute('title') || this._config.title;
    if (name === 'theme') this._applyTheme();
  }

  get endpoint() {
    return normalizeEndpoint(this.getAttribute('endpoint') || window.location.origin, window.location.href);
  }

  get token() {
    return this.getAttribute('token') || '';
  }

  _applyTheme() {
    const value = this.getAttribute('theme') || this._config.theme || 'auto';
    this.setAttribute('theme', ['light', 'dark', 'auto'].includes(value) ? value : 'auto');
  }

  _apiUrl(path) {
    return new URL(`/v1/widget/${path}`, `${this.endpoint}/`).href;
  }

  _renderShell() {
    const root = this.attachShadow({ mode: 'open' });
    const style = element('style', { text: CSS });
    const launcher = element('button', {
      className: 'launcher',
      text: 'Ask docs',
      attributes: { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }
    });
    const panel = element('section', {
      className: 'panel',
      attributes: { hidden: '', role: 'dialog', 'aria-label': 'Documentation assistant' }
    });
    const header = element('header', { className: 'header' });
    const title = element('h2', { className: 'title', text: this.getAttribute('title') || this._config.title });
    const close = element('button', { className: 'close', text: '×', attributes: { type: 'button', 'aria-label': 'Close documentation assistant' } });
    header.append(title, close);

    const messages = element('div', {
      className: 'messages',
      attributes: { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions text' }
    });
    const welcome = element('div', { className: 'message assistant' });
    welcome.append(element('span', { className: 'state', text: 'Documentation assistant' }));
    welcome.append(element('p', { className: 'answer', text: 'Ask a question and I will answer from the approved documentation.' }));
    messages.append(welcome);

    const form = element('form', { className: 'form' });
    const label = element('label', { className: 'sr-only', text: 'Documentation question', attributes: { for: 'docsage-question' } });
    const row = element('div', { className: 'row' });
    const question = element('textarea', {
      className: 'question',
      attributes: {
        id: 'docsage-question',
        name: 'question',
        rows: '2',
        maxlength: String(this._config.questionCharacters),
        placeholder: this._config.placeholder,
        required: '',
        enterkeyhint: 'send'
      }
    });
    const send = element('button', { className: 'send', text: 'Send', attributes: { type: 'submit' } });
    row.append(question, send);
    const status = element('p', { className: 'status', attributes: { role: 'status', 'aria-live': 'polite' } });
    form.append(label, row, status);
    panel.append(header, messages, form);
    root.append(style, launcher, panel);

    this._root = root;
    this._launcher = launcher;
    this._panel = panel;
    this._title = title;
    this._messages = messages;
    this._form = form;
    this._question = question;
    this._send = send;
    this._status = status;

    launcher.addEventListener('click', () => this.open());
    close.addEventListener('click', () => this.close());
    form.addEventListener('submit', (event) => this._submit(event));
    question.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
    this._applyTheme();
  }

  open() {
    this._panel.hidden = false;
    this._launcher.setAttribute('aria-expanded', 'true');
    queueMicrotask(() => this._question.focus());
    this.dispatchEvent(new CustomEvent('docsage:open', { bubbles: true, composed: true }));
  }

  close() {
    this._panel.hidden = true;
    this._launcher.setAttribute('aria-expanded', 'false');
    this._launcher.focus();
    this.dispatchEvent(new CustomEvent('docsage:close', { bubbles: true, composed: true }));
  }

  async _loadConfig() {
    if (!this.token) {
      this._setStatus('Widget token is missing.');
      return;
    }
    try {
      const response = await fetch(this._apiUrl('config'), {
        headers: { authorization: `Bearer ${this.token}` },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) return;
      this._config = normalizeWidgetConfig(await readJson(response));
      this._title.textContent = this.getAttribute('title') || this._config.title;
      this._question.placeholder = this._config.placeholder;
      this._question.maxLength = this._config.questionCharacters;
      if (!this.hasAttribute('theme')) this.setAttribute('theme', this._config.theme);
    } catch {
      // Configuration is an enhancement; the widget remains usable with local defaults.
    }
  }

  _setStatus(text) {
    this._status.textContent = text;
  }

  _appendMessage(node) {
    this._messages.append(node);
    while (this._messages.children.length > 10) this._messages.firstElementChild?.remove();
    node.scrollIntoView({ block: 'end', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  _userMessage(text) {
    this._appendMessage(element('div', { className: 'message user', text }));
  }

  _errorMessage(message) {
    const node = element('div', { className: 'message assistant error' });
    node.append(element('span', { className: 'state', text: 'Request failed' }));
    node.append(element('p', { className: 'answer', text: message }));
    this._appendMessage(node);
  }

  _answerMessage(answer) {
    const node = element('article', { className: 'message assistant' });
    node.append(element('span', { className: 'state', text: answer.stateLabel }));
    node.append(element('p', { className: 'answer', text: answer.answer || answer.stateLabel }));
    if (answer.citations.length) {
      const list = element('ol', { className: 'citations', attributes: { 'aria-label': 'Sources' } });
      for (const citation of answer.citations) {
        const item = element('li');
        const link = element('a', {
          text: citation.label,
          attributes: { href: citation.url, target: '_blank', rel: 'noopener noreferrer' }
        });
        item.append(link);
        list.append(item);
      }
      node.append(list);
    }
    node.dataset.traceId = answer.traceId;
    this._appendMessage(node);
  }

  async _submit(event) {
    event.preventDefault();
    if (this._busy) return;
    let payload;
    try {
      payload = buildAnswerRequest(this._question.value, window.location.href, this._config.questionCharacters);
    } catch (error) {
      this._setStatus(error.message);
      return;
    }
    if (!this.token) {
      this._setStatus('Widget token is missing.');
      return;
    }

    this._busy = true;
    this._send.disabled = true;
    this._setStatus('Searching the documentation…');
    this._userMessage(payload.question);
    this._controller?.abort();
    this._controller = new AbortController();
    const timeout = setTimeout(() => this._controller.abort(), 15_000);

    try {
      const response = await fetch(this._apiUrl('answer'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: this._controller.signal
      });
      const body = await readJson(response);
      if (!response.ok) {
        const publicError = normalizePublicError(body);
        throw Object.assign(new Error(publicError.message), { publicError });
      }
      const answer = normalizeAnswerPayload(body);
      this._answerMessage(answer);
      this._question.value = '';
      this._setStatus('Answer complete.');
      this.dispatchEvent(new CustomEvent('docsage:answer', {
        detail: { traceId: answer.traceId, state: answer.state, citationCount: answer.citations.length },
        bubbles: true,
        composed: true
      }));
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      const message = aborted ? 'The request timed out. Your question is still available to retry.' : (error?.message || 'The request could not be completed.');
      this._errorMessage(message);
      this._setStatus(message);
      this.dispatchEvent(new CustomEvent('docsage:error', {
        detail: { code: error?.publicError?.code || (aborted ? 'TIMEOUT' : 'REQUEST_FAILED'), retryable: error?.publicError?.retryable ?? true },
        bubbles: true,
        composed: true
      }));
    } finally {
      clearTimeout(timeout);
      this._busy = false;
      this._send.disabled = false;
    }
  }
}

if (!customElements.get('docsage-widget')) {
  customElements.define('docsage-widget', DocSageWidget);
}
