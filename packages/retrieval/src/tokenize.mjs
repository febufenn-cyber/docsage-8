const STOP = new Set(['a','an','and','are','as','at','be','by','can','do','does','for','from','how','i','in','is','it','of','on','or','the','to','what','when','where','which','with']);

function variants(token) {
  const result = new Set([token]);
  if (token.length > 4 && token.endsWith('ies')) result.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) result.add(token.slice(0, -1));
  if (token.length > 5 && token.endsWith('ing')) {
    let base = token.slice(0, -3);
    if (base.length > 2 && base.at(-1) === base.at(-2)) base = base.slice(0, -1);
    result.add(base);
    result.add(`${base}e`);
  }
  if (token.length > 4 && token.endsWith('ed')) result.add(token.slice(0, -2));
  return [...result];
}

export function tokenize(value) {
  const raw = String(value ?? '').toLowerCase().match(/[a-z0-9_@./:-]+/g) ?? [];
  return raw.filter((token) => token.length > 1 && !STOP.has(token)).flatMap(variants);
}

export function exactIdentifiers(value) {
  const text = String(value ?? '');
  const quoted = [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const technical = text.match(/(?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*|@[\w/-]+|--[\w-]+|\b[A-Z][A-Z0-9_-]{2,}\b|\b\d{3}\b/g) ?? [];
  return [...new Set([...quoted, ...technical].map((item) => item.toLowerCase()))];
}
