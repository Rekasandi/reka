import { useEffect, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Button } from '@reka/ui';
import { BlockEditor, CodeBlock, SlashCommand, getSlashCommandSuggestion, defaultSlashCommandItems } from '@reka/ui/block-editor';
import { useUpdateProject } from '../hooks/use-projects';
import { parseProjectDescription } from '../lib/project-description';

interface Props {
  projectId: string;
  description?: string | null;
}

export default function ProjectDescriptionEditor({ projectId, description }: Props) {
  const updateProject = useUpdateProject();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseline = useRef('');
  const serverDescription = useRef(description);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
      CodeBlock,
      Placeholder.configure({ placeholder: 'Describe this project… Type / for blocks.' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      SlashCommand.configure({ suggestion: getSlashCommandSuggestion(defaultSlashCommandItems) }),
    ],
    content: parseProjectDescription(description),
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Project description',
        'aria-multiline': 'true',
      },
    },
    onCreate: ({ editor }) => { baseline.current = JSON.stringify(editor.getJSON()); },
    onUpdate: ({ editor }) => {
      setDirty(JSON.stringify(editor.getJSON()) !== baseline.current);
      setError(null);
    },
  });

  // Don't replace a local draft when other project properties are refreshed.
  useEffect(() => {
    if (!editor || serverDescription.current === description) return;
    serverDescription.current = description;
    if (dirty || saving) return;
    editor.commands.setContent(parseProjectDescription(description), { emitUpdate: false });
    baseline.current = JSON.stringify(editor.getJSON());
  }, [description, editor, dirty, saving]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function cancel() {
    if (!editor) return;
    editor.commands.setContent(parseProjectDescription(description), { emitUpdate: false });
    baseline.current = JSON.stringify(editor.getJSON());
    serverDescription.current = description;
    setDirty(false);
    setError(null);
  }

  async function save() {
    if (!editor || !dirty || saving) return;
    const snapshot = JSON.stringify(editor.getJSON());
    // Store an empty description as plain text so existing empty-state checks still work.
    const value = editor.isEmpty ? '' : snapshot;
    setSaving(true);
    setError(null);
    editor.setEditable(false, false);
    try {
      await updateProject.mutateAsync({ id: projectId, data: { description: value } });
      baseline.current = snapshot;
      setDirty(false);
    } catch {
      setError('Could not save the description. Your draft is still here. Try again.');
    } finally {
      setSaving(false);
      if (!editor.isDestroyed) editor.setEditable(true, false);
    }
  }

  return (
    <section aria-label="Project description editor" className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">Description</h2>
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : ''}
          </span>
          {dirty && <Button variant="ghost" size="sm" disabled={saving} onClick={cancel}>Cancel</Button>}
          <Button variant="outline" size="sm" disabled={!editor || !dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save description'}
          </Button>
        </div>
      </div>
      <BlockEditor editor={editor} className="project-description-editor text-sm leading-relaxed" />
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}
