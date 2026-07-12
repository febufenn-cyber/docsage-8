export class ExtractiveProvider {
  name = 'evidence-extractive-v2';

  async generate({ evidence }) {
    if (!evidence.length) return { answer: '', claims: [], variableCostUsd: 0 };
    const selected = evidence.slice(0, 5).map((item) => ({
      text: item.displayText.trim(),
      evidenceIds: [item.id]
    })).filter((claim) => claim.text.length > 0);
    return {
      answer: selected.map((claim) => claim.text).join('\n\n'),
      claims: selected,
      variableCostUsd: 0
    };
  }
}
