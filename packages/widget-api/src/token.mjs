import { compileOriginPolicy } from './origin.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class WidgetTokenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WidgetTokenError';
    this.code = code;
  }
}

function base64url(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token is malformed.');
  }
  const padding = '='.repeat((4 - value.length % 4) % 4);
  try {
    return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding), (char) => char.charCodeAt(0));
  } catch {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token is malformed.');
  }
}

async function importKey(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new WidgetTokenError('TOKEN_SECRET_INVALID', 'Widget token secrets must be at least 32 characters.');
  }
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function encodeJson(value) {
  return base64url(encoder.encode(JSON.stringify(value)));
}

function decodeJson(value) {
  try {
    return JSON.parse(decoder.decode(decodeBase64url(value)));
  } catch (error) {
    if (error instanceof WidgetTokenError) throw error;
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token payload is invalid.');
  }
}

function validatePayload(payload, nowSeconds) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token payload is invalid.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token project scope is invalid.');
  }
  compileOriginPolicy(payload.origins);
  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= payload.iat) {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token lifetime is invalid.');
  }
  if (payload.exp <= nowSeconds) {
    throw new WidgetTokenError('TOKEN_EXPIRED', 'The widget token has expired.');
  }
  if (payload.iat > nowSeconds + 60) {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token is not active yet.');
  }
  if (typeof payload.jti !== 'string' || !payload.jti || payload.jti.length > 128) {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token ID is invalid.');
  }
  return payload;
}

export async function issueWidgetToken(options) {
  const {
    secret,
    projectId,
    origins,
    expiresInSeconds = 86_400,
    now = Date.now(),
    tokenId = crypto.randomUUID(),
    keyId = 'default',
    config = undefined
  } = options ?? {};
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 31_536_000) {
    throw new WidgetTokenError('TOKEN_LIFETIME_INVALID', 'Token lifetime must be between one minute and one year.');
  }
  compileOriginPolicy(origins);
  if (typeof projectId !== 'string' || !projectId.trim() || projectId.length > 128) {
    throw new WidgetTokenError('TOKEN_SCOPE_INVALID', 'A valid project ID is required.');
  }
  const issuedAt = Math.floor(now / 1000);
  const header = { alg: 'HS256', typ: 'DSW', kid: String(keyId).slice(0, 64) };
  const payload = {
    sub: projectId,
    origins: [...origins],
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
    jti: String(tokenId).slice(0, 128),
    ...(config === undefined ? {} : { config })
  };
  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = await crypto.subtle.sign('HMAC', await importKey(secret), encoder.encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyWidgetToken(token, options) {
  const { secret, now = Date.now() } = options ?? {};
  if (typeof token !== 'string' || token.length > 8192) {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token is malformed.');
  }
  const parts = token.split('.');
  if (parts.length !== 3) throw new WidgetTokenError('TOKEN_INVALID', 'The widget token is malformed.');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart);
  if (header?.alg !== 'HS256' || header?.typ !== 'DSW') {
    throw new WidgetTokenError('TOKEN_INVALID', 'The widget token algorithm is invalid.');
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    await importKey(secret),
    decodeBase64url(signaturePart),
    encoder.encode(`${headerPart}.${payloadPart}`)
  );
  if (!valid) throw new WidgetTokenError('TOKEN_INVALID', 'The widget token signature is invalid.');
  const payload = validatePayload(decodeJson(payloadPart), Math.floor(now / 1000));
  return { header, payload };
}

export function readBearerToken(request) {
  const header = request.headers.get('authorization');
  if (!header) throw new WidgetTokenError('TOKEN_REQUIRED', 'A widget token is required.');
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new WidgetTokenError('TOKEN_INVALID', 'The widget token is malformed.');
  return match[1];
}
