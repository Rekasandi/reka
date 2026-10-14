import type { JSONContent } from '@tiptap/react';

// Keep structured descriptions in the existing text field; old plain text stays compatible.
export function parseProjectDescription(value?: string | null): JSONContent {
  if (value) {
    try {
      const doc = JSON.parse(value);
      if (doc?.type === 'doc' && Array.isArray(doc.content)) return doc;
    } catch {
      // Legacy descriptions are literal text, never interpreted as HTML.
    }
  }
  return {
    type: 'doc',
    content: (value || '').split(/\r?\n/).map((text) => ({
      type: 'paragraph',
      ...(text ? { content: [{ type: 'text', text }] } : {}),
    })),
  };
}

export function projectDescriptionText(value?: string | null): string {
  function text(node: JSONContent): string {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    return (node.content || []).map(text).join(node.type === 'doc' || node.type?.endsWith('List') ? '\n' : '');
  }
  return text(parseProjectDescription(value)).trim();
}
