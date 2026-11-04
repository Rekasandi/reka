import { useEffect, useRef, useState } from 'react';
import { Button, FieldError, Textarea } from '@reka/ui';
import { useUpdateProject } from '../hooks/use-projects';
import { parseProjectDescription } from '../lib/project-description';

interface Props {
  projectId: string;
  description?: string | null;
}

export default function ProjectDescriptionEditor({ projectId, description }: Props) {
  const updateProject = useUpdateProject();
  const initialValue = parseProjectDescription(description);
  const [content, setContent] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseline = useRef(initialValue);
  const serverDescription = useRef(description);

  const dirty = content !== baseline.current;

  // Don't replace a local draft when other project properties are refreshed.
  useEffect(() => {
    if (serverDescription.current === description) return;
    serverDescription.current = description;
    if (dirty || saving) return;
    const next = parseProjectDescription(description);
    setContent(next);
    baseline.current = next;
  }, [description, dirty, saving]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function cancel() {
    setContent(baseline.current);
    serverDescription.current = description;
    setError(null);
  }

  async function save() {
    if (!dirty || saving) return;
    const value = content.trim();
    setSaving(true);
    setError(null);
    try {
      await updateProject.mutateAsync({ id: projectId, data: { description: value } });
      baseline.current = content;
    } catch {
      setError('Could not save the description. Your draft is still here. Try again.');
    } finally {
      setSaving(false);
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
          <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save description'}
          </Button>
        </div>
      </div>
      <Textarea
        aria-label="Project description"
        placeholder="Describe this project in Markdown…"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={6}
        className="project-description-editor min-h-[140px] resize-y text-sm leading-relaxed"
      />
      {error && <FieldError role="alert" className="mt-2 text-xs text-destructive">{error}</FieldError>}
    </section>
  );
}
