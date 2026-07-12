import { stableId } from '../../core/src/hash.mjs';

function blockText(block) {
  if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'callout') return block.text;
  if (block.type === 'code') return `${block.language ? `${block.language}\n` : ''}${block.text}`;
  if (block.type === 'list') return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${item}`).join('\n');
  if (block.type === 'table') return block.rows.map((row) => row.join(' | ')).join('\n');
  return '';
}

function isAttachment(block) {
  return block.type === 'code' || block.type === 'callout' || block.type === 'table';
}

export function chunkDocument(document, options = {}) {
  const { maxChars = 1800, overlapBlocks = 1, chunkerVersion = 'phase1-v1' } = options;
  const chunks = [];
  let group = [];
  let chars = 0;

  const flush = () => {
    const meaningful = group.filter((block) => block.type !== 'heading');
    if (!meaningful.length) { group = []; chars = 0; return; }
    const headingPath = [...(meaningful[0].headingPath ?? [])];
    const body = group.map(blockText).filter(Boolean).join('\n\n').trim();
    const displayText = meaningful.map(blockText).filter(Boolean).join('\n\n').trim();
    const id = stableId('chunk', document.id, headingPath.join(' > '), body, chunkerVersion);
    chunks.push({
      id,
      projectId: document.projectId,
      sourceRevisionId: document.sourceRevisionId,
      documentRevisionId: document.id,
      canonicalUrl: document.canonicalUrl,
      title: document.title,
      headingPath,
      version: document.version,
      runtime: document.runtime,
      authorityLevel: document.authorityLevel,
      searchText: [document.title, ...headingPath, body].join('\n'),
      displayText,
      blockTypes: [...new Set(meaningful.map((block) => block.type))],
      citationAnchor: headingPath.at(-1) ?? document.title,
      active: true
    });
    group = overlapBlocks > 0 ? group.slice(-overlapBlocks) : [];
    chars = group.reduce((sum, block) => sum + blockText(block).length, 0);
  };

  for (const block of document.blocks) {
    if (block.type === 'heading' && group.some((item) => item.type !== 'heading')) flush();
    const text = blockText(block);
    const nextSize = chars + text.length + 2;
    const shouldAttach = isAttachment(block) && group.some((item) => item.type === 'paragraph');
    if (group.length && nextSize > maxChars && !shouldAttach) flush();
    group.push(block);
    chars += text.length + 2;
    if (chars > maxChars * 1.5 && !isAttachment(block)) flush();
  }
  flush();
  return chunks;
}
