import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Input, Skeleton, Textarea } from '@reka/ui';
import { Archive, ArrowLeft, RefreshCw, RotateCcw, Save, Star } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import { useToggleFavorite, useFavorites } from '../../views/hooks/use-views';
import { useArchiveDocument, useDocument, useRestoreDocument, useUpdateDocument } from '../hooks/use-documents';
import { useProjects } from '../hooks/use-projects';
import { useTeams } from '../../teams/hooks/use-teams';

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: document, isLoading, isError, refetch } = useDocument(id);
  const { data: projects = [] } = useProjects();
  const { data: teams = [] } = useTeams();
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const update = useUpdateDocument();
  const archive = useArchiveDocument();
  const restore = useRestoreDocument();
  const actor = useAuthStore(state => state.user);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const baseline = React.useRef('');
  const serverId = React.useRef<string | undefined>(undefined);
  const isFavorite = favorites.some(item => item.resourceType === 'document' && item.resourceId === id);
  const canFavorite = actor?.role === 'owner' || actor?.role === 'admin' || actor?.role === 'member';

  React.useEffect(() => {
    if (!document || serverId.current === document.id) return;
    serverId.current = document.id;
    setTitle(document.title); setContent(document.content); baseline.current = `${document.title}\n${document.content}`; setDirty(false);
  }, [document]);
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const current = `${title}\n${content}`;
  const isDirty = dirty || current !== baseline.current;
  const scope = document?.projectId ? `Project · ${projects.find(project => project.id === document.projectId)?.name ?? 'Project'}`
    : document?.teamId ? `Team · ${teams.find(team => team.id === document.teamId)?.name ?? 'Team'}` : 'Workspace';
  async function save() {
    if (!document || !isDirty || update.isPending) return;
    setSaveError('');
    try {
      const saved = await update.mutateAsync({ id: document.id, input: { title: title.trim(), content } });
      baseline.current = `${saved.title}\n${saved.content}`; setTitle(saved.title); setContent(saved.content); setDirty(false);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save document. Your draft is still here.'); }
  }
  function discard() {
    if (!document) return;
    setTitle(document.title); setContent(document.content); baseline.current = `${document.title}\n${document.content}`; setDirty(false); setSaveError('');
  }

  if (isLoading) return <div role="status" aria-label="Loading document" className="flex flex-col gap-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-72 w-full" /></div>;
  if (isError || !document) return <div className="flex flex-col items-center gap-3 py-20"><p className="text-sm text-muted-foreground">Document unavailable or access was revoked.</p><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>;

  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-10">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2"><Link to="/documents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" />Documents</Link><p className="text-xs text-muted-foreground">{scope} · Updated {new Date(document.updatedAt).toLocaleString()}</p></div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={isFavorite ? 'Remove document from favorites' : 'Add document to favorites'} disabled={!canFavorite || toggleFavorite.isPending} onClick={() => toggleFavorite.mutate({ resourceType: 'document', resourceId: document.id, favorite: !isFavorite })}><Star className={isFavorite ? 'fill-current text-amber-500' : ''} /></Button>
        {document.archivedAt ? <Button variant="outline" size="sm" disabled={restore.isPending} onClick={() => restore.mutate(document.id)}><RotateCcw data-icon="inline-start" />Restore</Button> : <Button variant="ghost" size="icon-sm" aria-label="Archive document" disabled={archive.isPending} onClick={() => archive.mutate(document.id)}><Archive /></Button>}
      </div>
    </header>
    {document.archivedAt && <Alert><AlertDescription>This document is archived and excluded from search. Restore it to continue editing.</AlertDescription></Alert>}
    <h1 className="sr-only">{title || 'Document'}</h1>
    <Input aria-label="Document title" value={title} maxLength={180} onChange={event => { setTitle(event.target.value); setDirty(true); setSaveError(''); }} disabled={!!document.archivedAt} className="h-auto border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-2 focus-visible:ring-ring" />
    <Textarea aria-label="Document content in Markdown" value={content} maxLength={50000} onChange={event => { setContent(event.target.value); setDirty(true); setSaveError(''); }} disabled={!!document.archivedAt} placeholder="Write in Markdown…" className="min-h-[50vh] resize-y border-0 px-0 text-sm leading-7 shadow-none focus-visible:ring-2 focus-visible:ring-ring" />
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <span aria-live="polite" className="text-xs text-muted-foreground">{update.isPending ? 'Saving…' : isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
      <div className="flex gap-2"><Button variant="ghost" size="sm" disabled={!isDirty || update.isPending} onClick={discard}>Discard</Button><Button size="sm" disabled={!isDirty || !title.trim() || update.isPending || !!document.archivedAt} onClick={() => void save()}><Save data-icon="inline-start" />{update.isPending ? 'Saving…' : 'Save'}</Button></div>
    </div>
    {saveError && <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>}
  </main>;
}
