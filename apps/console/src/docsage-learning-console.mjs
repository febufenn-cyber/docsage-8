import { formatCount, normalizeCollection, normalizeConsoleEndpoint, normalizeSummary } from './contracts.mjs';

const CSS = `
:host {
  --docsage-console-accent: #315efb;
  --docsage-console-bg: #f8fafc;
  --docsage-console-panel: #ffffff;
  --docsage-console-text: #172033;
  --docsage-console-muted: #667085;
  --docsage-console-border: #d0d5dd;
  display: block;
  color: var(--docsage-console-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
.shell { min-height: 480px; padding: 24px; border: 1px solid var(--docsage-console-border); border-radius: 18px; background: var(--docsage-console-bg); }
.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
h2, h3, p { margin-top: 0; }
.subtitle, .status, .muted { color: var(--docsage-console-muted); }
button { font: inherit; }
.refresh, .tab { min-height: 42px; border: 1px solid var(--docsage-console-border); border-radius: 10px; padding: 8px 12px; color: var(--docsage-console-text); background: var(--docsage-console-panel); cursor: pointer; }
.refresh:focus-visible, .tab:focus-visible { outline: 3px solid color-mix(in srgb, var(--docsage-console-accent) 55%, white); outline-offset: 2px; }
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.card { padding: 16px; border: 1px solid var(--docsage-console-border); border-radius: 14px; background: var(--docsage-console-panel); }
.value { display: block; margin-top: 6px; font-size: 28px; font-weight: 750; }
.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tab[aria-selected="true"] { border-color: var(--docsage-console-accent); color: var(--docsage-console-accent); font-weight: 700; }
.panel { overflow-x: auto; padding: 16px; border: 1px solid var(--docsage-console-border); border-radius: 14px; background: var(--docsage-console-panel); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px; border-bottom: 1px solid var(--docsage-console-border); text-align: left; vertical-align: top; }
th { font-weight: 700; }
.badge { display: inline-block; border: 1px solid var(--docsage-console-border); border-radius: 999px; padding: 2px 8px; font-size: 12px; }
.empty { padding: 24px; text-align: center; color: var(--docsage-console-muted); }
.status { min-height: 22px; margin-top: 12px; }
@media (max-width: 700px) { .cards { grid-template-columns: 1fr; } .shell { padding: 16px; } }
@media (prefers-color-scheme: dark) {
  :host { --docsage-console-bg: #101828; --docsage-console-panel: #182230; --docsage-console-text: #f2f4f7; --docsage-console-muted: #98a2b3; --docsage-console-border: #344054; }
}
`;

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  return node;
}

function cell(text) { return el('td', { text: text ?? '—' }); }

export class DocSageLearningConsole extends HTMLElement {
  constructor() {
    super();
    this._active = 'clusters';
    this._summary = null;
    this._collections = new Map();
    this._controller = null;
  }

  connectedCallback() {
    if (this.shadowRoot) return;
    this._renderShell();
    this.refresh();
  }

  disconnectedCallback() { this._controller?.abort(); }

  get endpoint() { return normalizeConsoleEndpoint(this.getAttribute('endpoint') || window.location.origin, window.location.href); }
  get projectId() { return (this.getAttribute('project-id') || '').trim(); }

  _url(resource) {
    if (!this.projectId) throw new Error('project-id is required');
    return new URL(`/v1/learning/projects/${encodeURIComponent(this.projectId)}/${resource}`, `${this.endpoint}/`).href;
  }

  _renderShell() {
    const root = this.attachShadow({ mode: 'open' });
    const style = el('style', { text: CSS });
    const shell = el('section', { className: 'shell', attributes: { 'aria-labelledby': 'learning-title' } });
    const header = el('header', { className: 'header' });
    const heading = el('div');
    heading.append(
      el('h2', { text: this.getAttribute('title') || 'Documentation learning console', attributes: { id: 'learning-title' } }),
      el('p', { className: 'subtitle', text: 'Privacy-bounded answer outcomes, gaps, feedback, and source health.' })
    );
    const refresh = el('button', { className: 'refresh', text: 'Refresh', attributes: { type: 'button' } });
    header.append(heading, refresh);

    const cards = el('div', { className: 'cards', attributes: { 'aria-label': 'Learning summary' } });
    const total = this._card('Events');
    const actionable = this._card('Actionable');
    const redactions = this._card('Redactions');
    cards.append(total.card, actionable.card, redactions.card);

    const tabs = el('div', { className: 'tabs', attributes: { role: 'tablist', 'aria-label': 'Learning views' } });
    this._tabs = new Map();
    for (const [id, label] of [['clusters', 'Clusters'], ['events', 'Events'], ['source-health', 'Source health'], ['summary', 'Daily summary']]) {
      const button = el('button', {
        className: 'tab', text: label,
        attributes: { type: 'button', role: 'tab', 'aria-selected': id === this._active ? 'true' : 'false', 'data-view': id }
      });
      button.addEventListener('click', () => this._select(id));
      tabs.append(button);
      this._tabs.set(id, button);
    }

    const panel = el('section', { className: 'panel', attributes: { role: 'tabpanel', tabindex: '0', 'aria-live': 'polite' } });
    const status = el('p', { className: 'status', attributes: { role: 'status', 'aria-live': 'polite' } });
    shell.append(header, cards, tabs, panel, status);
    root.append(style, shell);

    this._panel = panel;
    this._status = status;
    this._values = { total: total.value, actionable: actionable.value, redactions: redactions.value };
    refresh.addEventListener('click', () => this.refresh());
  }

  _card(label) {
    const card = el('article', { className: 'card' });
    const value = el('strong', { className: 'value', text: '—' });
    card.append(el('span', { className: 'muted', text: label }), value);
    return { card, value };
  }

  async _fetch(resource) {
    const response = await fetch(this._url(resource), {
      credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer', signal: this._controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || 'The learning request failed.');
    return payload;
  }

  async refresh() {
    this._controller?.abort();
    this._controller = new AbortController();
    this._status.textContent = 'Loading learning data…';
    try {
      const [summary, clusters, events, sources] = await Promise.all([
        this._fetch('summary'), this._fetch('clusters?limit=100'), this._fetch('events?limit=100'), this._fetch('source-health?limit=100')
      ]);
      this._summary = normalizeSummary(summary);
      this._collections.set('clusters', normalizeCollection(clusters, 'clusters'));
      this._collections.set('events', normalizeCollection(events, 'events'));
      this._collections.set('source-health', normalizeCollection(sources, 'source health'));
      this._values.total.textContent = formatCount(this._summary.eventCount);
      this._values.actionable.textContent = formatCount(this._summary.actionableCount);
      this._values.redactions.textContent = formatCount(this._summary.redactionCount);
      this._renderActive();
      this._status.textContent = 'Learning data loaded.';
      this.dispatchEvent(new CustomEvent('docsage:learning-loaded', {
        detail: { projectId: this._summary.projectId, eventCount: this._summary.eventCount, actionableCount: this._summary.actionableCount },
        bubbles: true, composed: true
      }));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this._panel.replaceChildren(el('p', { className: 'empty', text: error?.message || 'The learning console could not load.' }));
      this._status.textContent = error?.message || 'The learning console could not load.';
    }
  }

  _select(id) {
    this._active = id;
    for (const [key, button] of this._tabs) button.setAttribute('aria-selected', key === id ? 'true' : 'false');
    this._renderActive();
    this._panel.focus();
  }

  _renderActive() {
    this._panel.replaceChildren();
    if (this._active === 'summary') return this._renderSummary();
    const collection = this._collections.get(this._active);
    if (!collection?.items.length) {
      this._panel.append(el('p', { className: 'empty', text: 'No records in this view.' }));
      return;
    }
    if (this._active === 'clusters') return this._renderClusters(collection.items);
    if (this._active === 'events') return this._renderEvents(collection.items);
    return this._renderSources(collection.items);
  }

  _table(headers) {
    const table = el('table');
    const head = el('thead');
    const row = el('tr');
    for (const label of headers) row.append(el('th', { text: label, attributes: { scope: 'col' } }));
    head.append(row);
    const body = el('tbody');
    table.append(head, body);
    this._panel.append(table);
    return body;
  }

  _renderClusters(items) {
    const body = this._table(['Category', 'Count', 'Negative feedback', 'Latest', 'Example']);
    for (const item of items) {
      const row = el('tr');
      const category = el('td');
      category.append(el('span', { className: 'badge', text: item.category || 'unknown' }));
      row.append(category, cell(item.count), cell(item.negativeFeedbackCount), cell(item.latestSeenAt), cell(item.questionExcerpt));
      body.append(row);
    }
  }

  _renderEvents(items) {
    const body = this._table(['Time', 'Type', 'State', 'Feedback', 'Excerpt']);
    for (const item of items) {
      const row = el('tr');
      row.append(cell(item.occurredAt), cell(item.type), cell(item.answerState), cell(item.feedbackRating), cell(item.questionExcerpt));
      body.append(row);
    }
  }

  _renderSources(items) {
    const body = this._table(['Source', 'Status', 'Failure', 'Updated']);
    for (const item of items) {
      const row = el('tr');
      row.append(cell(item.sourceId), cell(item.status), cell(item.failureCode), cell(item.occurredAt));
      body.append(row);
    }
  }

  _renderSummary() {
    const rows = this._summary?.daily ?? [];
    if (!rows.length) return this._panel.append(el('p', { className: 'empty', text: 'No daily metrics are available.' }));
    const body = this._table(['Day', 'Events', 'Actionable', 'Useful', 'Not useful']);
    for (const item of rows) {
      const row = el('tr');
      row.append(cell(item.day), cell(item.total), cell(item.actionable), cell(item.feedback?.useful ?? 0), cell(item.feedback?.not_useful ?? 0));
      body.append(row);
    }
  }
}

if (!customElements.get('docsage-learning-console')) {
  customElements.define('docsage-learning-console', DocSageLearningConsole);
}
