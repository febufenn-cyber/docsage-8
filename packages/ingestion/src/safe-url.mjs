import dns from 'node:dns/promises';
import net from 'node:net';

function ipv4Number(address) {
  return address.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function inV4Range(address, base, maskBits) {
  const value = ipv4Number(address);
  const network = ipv4Number(base);
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (value & mask) === (network & mask);
}

export function isBlockedAddress(address) {
  if (net.isIPv4(address)) {
    return [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
      ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
      ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
    ].some(([base, bits]) => inV4Range(address, base, bits));
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith('ff')) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isBlockedAddress(mapped[1]) : false;
  }
  return true;
}

export async function assertPublicUrl(input, options = {}) {
  const { lookup = dns.lookup, allowHttp = false } = options;
  let url;
  try { url = new URL(input); } catch { throw new TypeError('Invalid URL'); }
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) {
    throw Object.assign(new Error('Only approved HTTP(S) URLs are allowed'), { code: 'SAFE_SSRF' });
  }
  if (url.username || url.password) throw Object.assign(new Error('URL credentials are prohibited'), { code: 'SAFE_SSRF' });
  const records = net.isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => isBlockedAddress(address))) {
    throw Object.assign(new Error(`Blocked network destination: ${url.hostname}`), { code: 'SAFE_SSRF' });
  }
  return url;
}
