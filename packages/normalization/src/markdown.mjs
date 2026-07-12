import { sha256, stableId } from '../../core/src/hash.mjs';

function flushParagraph(buffer, blocks, headingPath) {
  const text = buffer.join(' ').trim();
  if (text) blocks.push({ type: 'paragraph', text, headingPath: [...headingPath] });
  buffer.length = 0;
}

export function normalizeMarkdown(input) {
  const {
    projectId, sourceRevisionId, canonicalUrl, markdown,
    title = 'Untitled', version = 'current', runtime = 'all', authorityLevel = 2,
    documentId = stableId('doc', projectId, canonicalUrl),
    documentRevisionId = stableId('docrev', sourceRevisionId, canonicalUrl, sha256(markdown))
  } = input;
  if (!projectId || !sourceRevisionId || !canonicalUrl || typeof markdown !== 'string') {
    throw new TypeError('projectId, sourceRevisionId, canonicalUrl and markdown are required');
  }

  const lines = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').split(/\r?\n/);
  const headingPath = [];
  const blocks = [];
  const paragraph = [];
  let code = null;
  let table = null;
  let list = null;

  const flushList = () => {
    if (list?.items.length) blocks.push({ type: 'list', ordered: list.ordered, items: list.items, headingPath: [...headingPath] });
    list = null;
  };
  const flushTable = () => {
    if (table?.rows.length) blocks.push({ type: 'table', rows: table.rows, headingPath: [...headingPath] });
    table = null;
  };

  for (const line of lines) {
    const fence = line.match(/^```\s*([\w+-]*)/);
    if (fence) {
      flushParagraph(paragraph, blocks, headingPath); flushList(); flushTable();
      if (code) {
        blocks.push({ type: 'code', language: code.language, text: code.lines.join('\n'), headingPath: [...headingPath] });
        code = null;
      } else code = { language: fence[1] || null, lines: [] };
      continue;
    }
    if (code) { code.lines.push(line); continue; }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      flushParagraph(paragraph, blocks, headingPath); flushList(); flushTable();
      const level = heading[1].length;
      headingPath.splice(level - 1);
      headingPath[level - 1] = heading[2].trim();
      blocks.push({ type: 'heading', level, text: heading[2].trim(), headingPath: [...headingPath] });
      continue;
    }

    const callout = line.match(/^>\s*(?:\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*)?(.*)$/i);
    if (callout) {
      flushParagraph(paragraph, blocks, headingPath); flushList(); flushTable();
      blocks.push({ type: 'callout', severity: (callout[1] ?? 'note').toLowerCase(), text: callout[2].trim(), headingPath: [...headingPath] });
      continue;
    }

    const listItem = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
    if (listItem) {
      flushParagraph(paragraph, blocks, headingPath); flushTable();
      const ordered = Boolean(listItem[2]);
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(listItem[3].trim());
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph(paragraph, blocks, headingPath); flushList();
      if (!/^\s*\|?\s*:?-{3,}/.test(line)) {
        table ??= { rows: [] };
        table.rows.push(line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
      }
      continue;
    }

    if (!line.trim()) {
      flushParagraph(paragraph, blocks, headingPath); flushList(); flushTable();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph(paragraph, blocks, headingPath); flushList(); flushTable();
  if (code) blocks.push({ type: 'code', language: code.language, text: code.lines.join('\n'), headingPath: [...headingPath] });

  return {
    id: documentRevisionId,
    documentId,
    projectId,
    sourceRevisionId,
    canonicalUrl,
    title,
    version,
    runtime,
    authorityLevel,
    contentHash: sha256(markdown),
    blocks
  };
}
