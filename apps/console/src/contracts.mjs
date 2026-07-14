function bounded(value, fallback, max = 240) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, max) : fallback;
}

export function normalizeConsoleEndpoint(value, base = 'https://invalid.local') {
  const url = new URL(value || base, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new TypeError('Console endpoint must use HTTP or HTTPS without credentials');
  }
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

export function normalizeSummary(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Learning summary is invalid');
  return {
    projectId: bounded(input.projectId, '', 128),
    eventCount: Number.isInteger(input.eventCount) && input.eventCount >= 0 ? input.eventCount : 0,
    actionableCount: Number.isInteger(input.actionableCount) && input.actionableCount >= 0 ? input.actionableCount : 0,
    redactionCount: Number.isInteger(input.redactionCount) && input.redactionCount >= 0 ? input.redactionCount : 0,
    range: {
      firstOccurredAt: typeof input.range?.firstOccurredAt === 'string' ? input.range.firstOccurredAt : null,
      lastOccurredAt: typeof input.range?.lastOccurredAt === 'string' ? input.range.lastOccurredAt : null
    },
    totals: input.totals && typeof input.totals === 'object' ? input.totals : {},
    daily: Array.isArray(input.daily) ? input.daily.slice(0, 366) : []
  };
}

export function normalizeCollection(input, kind) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.items)) throw new TypeError(`${kind} response is invalid`);
  return {
    projectId: bounded(input.projectId, '', 128),
    total: Number.isInteger(input.total) && input.total >= 0 ? input.total : input.items.length,
    items: input.items.slice(0, 100)
  };
}

export function formatCount(value) {
  return new Intl.NumberFormat('en').format(Number.isFinite(value) ? value : 0);
}
