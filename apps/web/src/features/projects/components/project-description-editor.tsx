import { useRef, useState } from 'react';
import { FieldError } from '@reka/ui';
import { LazyNotionEditor } from '../../../components/editor/lazy-notion-editor';
import { useUpdateProject } from '../hooks/use-projects';
import { parseProjectDescription } from '../lib/project-description';

interface Props {
  projectId: string;
  description?: string | null;
}

/** Notion-style description: saves on its own when typing pauses or focus leaves; no Save button. */
export default function ProjectDescriptionEditor({ projectId, description }: Props) {
  const updateProject = useUpdateProject();
  const text = parseProjectDescription(description);
  const lastSaved = useRef(text.trim());
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(markdown: string) {
    const value = markdown.trim();
    if (value === lastSaved.current) return;
    setStatus('saving');
    try {
      await updateProject.mutateAsync({ id: projectId, data: { description: value } });
      lastSaved.current = value;
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section aria-label="Project description editor" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">Description</h2>
        <span aria-live="polite" className="text-xs text-muted-foreground">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>
      </div>
      <LazyNotionEditor
        key={projectId}
        aria-label="Project description"
        defaultValue={text}
        value={text}
        placeholder="Describe this project… Type '/' for blocks"
        onChange={(markdown) => void save(markdown)}
        onBlur={(markdown) => void save(markdown)}
        className="project-description-editor min-h-[140px]"
      />
      {status === 'error' && <FieldError role="alert" className="mt-2 text-xs text-destructive">Could not save the description. Your text is still here; keep editing to try again.</FieldError>}
    </section>
  );
}
