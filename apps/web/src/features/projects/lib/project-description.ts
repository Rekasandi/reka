// Keep structured descriptions compatible; converts legacy JSON or plain text into clean string.
function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) || '';
  if (node.type === 'hardBreak') return '\n';
  const content = Array.isArray(node.content) ? (node.content as Record<string, unknown>[]) : [];
  const separator = node.type === 'doc' || (typeof node.type === 'string' && node.type.endsWith('List')) ? '\n' : '';
  return content.map(extractText).join(separator);
}

export function parseProjectDescription(value?: string | null): string {
  if (!value) return '';
  try {
    const doc = JSON.parse(value);
    if (doc?.type === 'doc' && Array.isArray(doc.content)) {
      return extractText(doc).trim();
    }
  } catch {
    // Plain text / Markdown
  }
  return value;
}

export function projectDescriptionText(value?: string | null): string {
  return parseProjectDescription(value).trim();
}
