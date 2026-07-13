const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export class OriginPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OriginPolicyError';
    this.code = code;
  }
}

export function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new OriginPolicyError('ORIGIN_REQUIRED', 'A request origin is required.');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new OriginPolicyError('ORIGIN_INVALID', 'The request origin is invalid.');
  }
  if (!HTTP_PROTOCOLS.has(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new OriginPolicyError('ORIGIN_INVALID', 'The request origin must be a plain HTTP or HTTPS origin.');
  }
  return url.origin.toLowerCase();
}

function parsePattern(pattern) {
  if (typeof pattern !== 'string' || !pattern.trim()) {
    throw new OriginPolicyError('ORIGIN_PATTERN_INVALID', 'Origin patterns must be non-empty strings.');
  }
  const trimmed = pattern.trim().toLowerCase();
  const wildcard = trimmed.match(/^(https?):\/\/\*\.([a-z0-9.-]+)(?::(\d+))?$/);
  if (wildcard) {
    const [, protocol, suffix, port = ''] = wildcard;
    if (!suffix.includes('.') || suffix.startsWith('.') || suffix.endsWith('.')) {
      throw new OriginPolicyError('ORIGIN_PATTERN_INVALID', `Invalid wildcard origin: ${pattern}`);
    }
    return { type: 'wildcard', protocol: `${protocol}:`, suffix, port };
  }
  return { type: 'exact', origin: normalizeOrigin(trimmed) };
}

export function compileOriginPolicy(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0 || patterns.length > 50) {
    throw new OriginPolicyError('ORIGIN_PATTERN_INVALID', 'Between one and fifty allowed origins are required.');
  }
  return patterns.map(parsePattern);
}

export function isOriginAllowed(origin, patterns) {
  const normalized = normalizeOrigin(origin);
  const url = new URL(normalized);
  const compiled = Array.isArray(patterns) && patterns.every((item) => item?.type)
    ? patterns
    : compileOriginPolicy(patterns);
  return compiled.some((pattern) => {
    if (pattern.type === 'exact') return normalized === pattern.origin;
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const expectedPort = pattern.port || (pattern.protocol === 'https:' ? '443' : '80');
    return url.protocol === pattern.protocol
      && port === expectedPort
      && url.hostname.endsWith(`.${pattern.suffix}`)
      && url.hostname !== pattern.suffix;
  });
}

export function assertOriginAllowed(origin, patterns) {
  const normalized = normalizeOrigin(origin);
  if (!isOriginAllowed(normalized, patterns)) {
    throw new OriginPolicyError('ORIGIN_NOT_ALLOWED', 'This widget is not enabled for the requesting origin.');
  }
  return normalized;
}
