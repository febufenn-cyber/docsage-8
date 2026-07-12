const STOP = new Set(['a','an','and','are','as','at','be','by','can','do','does','for','from','how','i','in','is','it','of','on','or','the','to','what','when','where','which','with']);

export function tokenize(value) {
  const raw = String(value ?? '').toLowerCase().match(/[a-z0-9_@./:-]+/g) ?? [];
  return raw.filter((token) => token.length > 1 && !STOP.has(token));
}

export function exactIdentifiers(value) {
  const text = String(value ?? '');
  const quoted = [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const technical = text.match(/(?:[A-Za-z_$][\w$]*\.)+[A-Za-z_$][\w$]*|@[\w/-]+|--[\w-]+|\b[A-Z][A-Z0-9_-]{2,}\b|\b\d{3}\b/g) ?? [];
  return [...new Set([...quoted, ...technical].map((item) => item.toLowerCase()))];
}
