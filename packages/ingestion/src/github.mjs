import { safeFetchText } from './fetch.mjs';

const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst', '.json', '.yaml', '.yml', '.ts', '.tsx', '.js', '.jsx']);
const SECRET_PATTERN = /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_\-]{20,}|AKIA[0-9A-Z]{16})/;

function extension(path) {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index).toLowerCase();
}

export async function fetchGitHubRepository({ owner, repo, ref, token, maxFiles = 500, include = ['docs/', 'README'] }, options = {}) {
  if (!owner || !repo || !ref) throw new TypeError('owner, repo and pinned ref are required');
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'docsage-phase1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const treeResult = await safeFetchText(treeUrl, { ...options, headers, allowedContentTypes: ['application/json'] });
  const tree = JSON.parse(treeResult.text);
  if (tree.truncated) throw Object.assign(new Error('GitHub tree was truncated'), { code: 'INGEST_DISCOVERY_MISS' });

  const files = tree.tree
    .filter((entry) => entry.type === 'blob' && TEXT_EXTENSIONS.has(extension(entry.path)))
    .filter((entry) => include.some((prefix) => entry.path.startsWith(prefix)))
    .slice(0, maxFiles);

  const results = [];
  for (const file of files) {
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const result = await safeFetchText(rawUrl, { ...options, allowedContentTypes: ['text/plain', 'text/markdown'] });
    results.push({
      path: file.path,
      url: rawUrl,
      quarantined: SECRET_PATTERN.test(result.text),
      text: SECRET_PATTERN.test(result.text) ? '' : result.text
    });
  }
  return results;
}
