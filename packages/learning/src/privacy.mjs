const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const SECRET_ASSIGNMENT = /\b(api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*[^\s,;]+/gi;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
const URL_WITH_PRIVATE_PARTS = /https?:\/\/[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?/gi;

function replaceCount(text, pattern, replacer) {
  let count = 0;
  const value = text.replace(pattern, (...args) => {
    count += 1;
    return typeof replacer === 'function' ? replacer(...args) : replacer;
  });
  return { value, count };
}

export function normalizeQuestionText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function redactSensitiveText(value, options = {}) {
  const maxCharacters = options.maxCharacters ?? 240;
  let text = normalizeQuestionText(value);
  let redactionCount = 0;

  for (const [pattern, replacement] of [
    [URL_WITH_PRIVATE_PARTS, (match) => {
      try {
        const url = new URL(match);
        url.search = '';
        url.hash = '';
        return url.href;
      } catch {
        return '[url]';
      }
    }],
    [EMAIL, '[email]'],
    [IPV4, '[ip]'],
    [BEARER, 'Bearer [token]'],
    [SECRET_ASSIGNMENT, (match, key) => `${key}=[secret]`],
    [LONG_TOKEN, '[token]']
  ]) {
    const result = replaceCount(text, pattern, replacement);
    text = result.value;
    redactionCount += result.count;
  }

  const characters = Array.from(text);
  const truncated = characters.length > maxCharacters;
  if (truncated) text = `${characters.slice(0, Math.max(0, maxCharacters - 1)).join('')}…`;

  return { text, redactionCount, truncated };
}

export async function fingerprintQuestion({ projectSalt, question }) {
  if (typeof projectSalt !== 'string' || projectSalt.length < 8) {
    throw new TypeError('projectSalt must contain at least 8 characters');
  }
  const redacted = redactSensitiveText(question, { maxCharacters: 10_000 });
  const normalized = redacted.text.toLocaleLowerCase('en-US');
  const bytes = new TextEncoder().encode(`${projectSalt}\u0000${normalized}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const fingerprint = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { fingerprint, redacted };
}
