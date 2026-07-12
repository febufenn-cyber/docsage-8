import { tokenize } from '../../retrieval/src/tokenize.mjs';

function sentenceScore(sentence, queryTokens) {
  const tokens = new Set(tokenize(sentence));
  return queryTokens.filter((token) => tokens.has(token)).length / Math.max(1, queryTokens.length);
}

export class ExtractiveProvider {
  name = 'extractive-v1';

  async generate({ question, evidence, state }) {
    if (!evidence.length) return { answer: '', claims: [] };
    const queryTokens = tokenize(question);
    const candidates = evidence.flatMap((item) => item.displayText
      .split(/(?<=[.!?])\s+|\n{2,}/)
      .map((sentence) => ({ sentence: sentence.trim(), evidenceId: item.id }))
      .filter((entry) => entry.sentence.length >= 20));
    const seen = new Set();
    const selected = candidates.sort((a, b) => sentenceScore(b.sentence, queryTokens) - sentenceScore(a.sentence, queryTokens))
      .filter((item) => { const key = item.sentence.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
      .slice(0, state === 'partially_supported' ? 1 : 3);
    const claims = selected.map((item) => ({ text: item.sentence, evidenceIds: [item.evidenceId] }));
    return { answer: selected.map((item) => item.sentence).join(' '), claims };
  }
}
