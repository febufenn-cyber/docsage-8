import { tokenize, exactIdentifiers } from './tokenize.mjs';

function hashToken(token, dimensions) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
  return Math.abs(hash) % dimensions;
}

export function hashEmbedding(text, dimensions = 512) {
  const vector = new Float64Array(dimensions);
  for (const token of tokenize(text)) vector[hashToken(token, dimensions)] += 1;
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return Array.from(vector, (value) => value / norm);
}

function cosine(a, b) {
  let score = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) score += a[index] * b[index];
  return score;
}

function bm25(queryTokens, documents) {
  const lengths = documents.map((tokens) => tokens.length);
  const average = lengths.reduce((sum, length) => sum + length, 0) / Math.max(1, lengths.length);
  const frequencies = new Map();
  for (const token of new Set(queryTokens)) frequencies.set(token, documents.filter((doc) => doc.includes(token)).length);
  return documents.map((tokens, documentIndex) => {
    const counts = new Map();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    let score = 0;
    for (const token of queryTokens) {
      const df = frequencies.get(token) ?? 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const tf = counts.get(token) ?? 0;
      score += idf * ((tf * 2.2) / (tf + 1.2 * (1 - 0.75 + 0.75 * lengths[documentIndex] / Math.max(1, average))));
    }
    return score;
  });
}

function ranks(scores) {
  return scores.map((score, index) => ({ index, score })).sort((a, b) => b.score - a.score)
    .reduce((map, item, rank) => map.set(item.index, rank + 1), new Map());
}

function coverage(queryTokens, text) {
  if (!queryTokens.length) return 0;
  const tokens = new Set(tokenize(text));
  return new Set(queryTokens.filter((token) => tokens.has(token))).size / new Set(queryTokens).size;
}

function phraseSignals(query, chunk) {
  const lowerQuery = String(query).toLowerCase();
  const title = String(chunk.title ?? '').toLowerCase();
  const headings = (chunk.headingPath ?? []).join(' ').toLowerCase();
  const slug = String(chunk.canonicalUrl ?? '').split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') ?? '';
  let score = 0;
  if (title && lowerQuery.includes(title)) score += 0.035;
  if (slug && lowerQuery.includes(slug)) score += 0.025;
  score += coverage(tokenize(query), `${title} ${headings} ${slug}`) * 0.025;
  return score;
}

function documentSignals(query, eligible, queryTokens) {
  const groups = new Map();
  for (const chunk of eligible) {
    const group = groups.get(chunk.canonicalUrl) ?? { url: chunk.canonicalUrl, chunks: [], text: '' };
    group.chunks.push(chunk);
    group.text += `\n${chunk.searchText}`;
    groups.set(chunk.canonicalUrl, group);
  }
  const documents = [...groups.values()];
  const tokens = documents.map((document) => tokenize(document.text));
  const keyword = bm25(queryTokens, tokens);
  const queryVector = hashEmbedding(query);
  const vectors = documents.map((document) => cosine(queryVector, hashEmbedding(document.text)));
  const keywordRanks = ranks(keyword);
  const vectorRanks = ranks(vectors);
  return new Map(documents.map((document, index) => [document.url, {
    keywordRank: keywordRanks.get(index),
    vectorRank: vectorRanks.get(index),
    coverage: coverage(queryTokens, document.text),
    score: 1 / (20 + keywordRanks.get(index)) + 1 / (20 + vectorRanks.get(index)) + coverage(queryTokens, document.text) * 0.05
  }]));
}

export function hybridRetrieve({ query, chunks, projectId, version = 'current', runtime = 'all', limit = 8 }) {
  const eligible = chunks.filter((chunk) => chunk.projectId === projectId && chunk.active !== false)
    .filter((chunk) => !version || chunk.version === version || chunk.version === 'all')
    .filter((chunk) => runtime === 'all' || chunk.runtime === 'all' || chunk.runtime === runtime);
  if (!eligible.length) return [];

  const queryTokens = tokenize(query);
  const documentTokens = eligible.map((chunk) => tokenize(chunk.searchText));
  const keywordScores = bm25(queryTokens, documentTokens);
  const queryVector = hashEmbedding(query);
  const vectorScores = eligible.map((chunk) => cosine(queryVector, hashEmbedding(chunk.searchText)));
  const keywordRanks = ranks(keywordScores);
  const vectorRanks = ranks(vectorScores);
  const documentScores = documentSignals(query, eligible, queryTokens);
  const identifiers = exactIdentifiers(query);

  const scored = eligible.map((chunk, index) => {
    const searchLower = chunk.searchText.toLowerCase();
    const exactMatches = identifiers.filter((identifier) => searchLower.includes(identifier)).length;
    const tokenCoverage = coverage(queryTokens, chunk.searchText);
    const fusion = 1 / (60 + keywordRanks.get(index)) + 1 / (60 + vectorRanks.get(index));
    const authorityBonus = Math.max(0, 5 - (chunk.authorityLevel ?? 5)) * 0.001;
    const exactBonus = exactMatches * 0.04;
    const coverageBonus = tokenCoverage * 0.035;
    const structureBonus = phraseSignals(query, chunk);
    const document = documentScores.get(chunk.canonicalUrl);
    return {
      ...chunk,
      score: fusion + authorityBonus + exactBonus + coverageBonus + structureBonus + (document?.score ?? 0),
      keywordScore: keywordScores[index],
      vectorScore: vectorScores[index],
      keywordRank: keywordRanks.get(index),
      vectorRank: vectorRanks.get(index),
      documentKeywordRank: document?.keywordRank,
      documentVectorRank: document?.vectorRank,
      tokenCoverage,
      exactMatches
    };
  }).sort((a, b) => b.score - a.score);

  const selected = [];
  const selectedIds = new Set();
  const documentCounts = new Map();
  const diversityTarget = Math.min(limit, 4);
  for (const item of scored) {
    if (selected.length >= diversityTarget) break;
    if (documentCounts.has(item.canonicalUrl)) continue;
    selected.push(item);
    selectedIds.add(item.id);
    documentCounts.set(item.canonicalUrl, 1);
  }
  for (const item of scored) {
    if (selected.length >= limit) break;
    if (selectedIds.has(item.id)) continue;
    const count = documentCounts.get(item.canonicalUrl) ?? 0;
    if (count >= 3) continue;
    selected.push(item);
    selectedIds.add(item.id);
    documentCounts.set(item.canonicalUrl, count + 1);
  }
  return selected;
}
