import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea } from '@reka/ui';
import { Archive, FileText, Plus, RefreshCw, RotateCcw, Search, Star } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import { useFavorites, useToggleFavorite } from '../../views/hooks/use-views';
import { useProjects } from '../hooks/use-projects';
import { useTeams } from '../../teams/hooks/use-teams';
import { useArchiveDocument, useCreateDocument, useDocuments, useRestoreDocument } from '../hooks/use-documents';
import type { ProjectDocument } from '../api/documents.api';

export function DocumentsPage({ fixedProjectId, fixedTeamId }: { fixedProjectId?: string; fixedTeamId?: string } = {}) {
  const [params] = useSearchParams();
  const projectId = fixedProjectId || params.get('projectId') || undefined;
  const teamId = fixedTeamId || params.get('teamId') || undefined;
  const [query, setQuery] = React.useState('');
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(params.get('new') === '1');
  const { data: documents = [], isLoading, isError, refetch } = useDocuments({ projectId, teamId }, includeArchived);
  const { data: projects = [] } = useProjects();
  const { data: teams = [] } = useTeams();
  const actor = useAuthStore(state => state.user);
  const canFavorite = actor?.role === 'owner' || actor?.role === 'admin' || actor?.role === 'member';
  const favorite = useToggleFavorite();
  const { data: favorites = [] } = useFavorites();
  const archive = useArchiveDocument();
  const restore = useRestoreDocument();
  const filtered = documents.filter(document => `${document.title} ${document.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const scopeLabel = (document: ProjectDocument) => document.projectId
    ? `Project · ${projects.find(project => project.id === document.projectId)?.name ?? 'Project'}`
    : document.teamId ? `Team · ${teams.find(team => team.id === document.teamId)?.name ?? 'Team'}` : 'Workspace';

  return <main className="flex flex-col gap-5 pb-10">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Documents</h1><p className="mt-1 max-w-2xl text-xs text-muted-foreground">Internal project, team and workspace documents. Access follows the resource they belong to.</p></div>
      <Button onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />New document</Button>
    </header>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block w-full sm:max-w-sm"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter documents…" aria-label="Filter documents" className="pl-9" /></label>
      <Button variant="category" size="sm" aria-pressed={includeArchived} onClick={() => setIncludeArchived(value => !value)}>{includeArchived ? 'Showing archived' : 'Include archived'}</Button>
    </div>
    {isLoading && <div role="status" aria-label="Loading documents" className="flex flex-col gap-2">{[1, 2, 3].map(item => <Skeleton key={item} className="h-14 w-full" />)}</div>}
    {isError && <div role="alert" className="flex items-center justify-between gap-3 border border-destructive/30 p-3 text-sm"><span>Could not load documents.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>}
    {!isLoading && !isError && (filtered.length ? <ul className="divide-y divide-border border-y border-border">{filtered.map(document => <li key={document.id} className="flex min-w-0 items-center gap-3 py-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <Link to={`/documents/${document.id}`} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block truncate text-sm font-medium">{document.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{scopeLabel(document)} · Updated {new Date(document.updatedAt).toLocaleDateString()}</span></Link>
      {document.archivedAt ? <Button variant="ghost" size="icon-sm" aria-label={`Restore ${document.title}`} disabled={restore.isPending} onClick={() => restore.mutate(document.id)}><RotateCcw /></Button> : <><Button variant="ghost" size="icon-sm" aria-label={favorites.some(item => item.resourceType === 'document' && item.resourceId === document.id) ? `Remove ${document.title} from favorites` : `Add ${document.title} to favorites`} disabled={!canFavorite || favorite.isPending} onClick={() => favorite.mutate({ resourceType: 'document', resourceId: document.id, favorite: !favorites.some(item => item.resourceType === 'document' && item.resourceId === document.id) })}><Star className={favorites.some(item => item.resourceType === 'document' && item.resourceId === document.id) ? 'fill-current text-amber-500' : ''} /></Button><Button variant="ghost" size="icon-sm" aria-label={`Archive ${document.title}`} disabled={archive.isPending} onClick={() => archive.mutate(document.id)}><Archive /></Button></>}
    </li>)}</ul> : <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">{query ? 'No documents match this filter.' : 'No documents yet. Create one to capture project context and decisions.'}</div>)}
    <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} fixedProjectId={projectId} fixedTeamId={teamId} />
  </main>;
}

function CreateDocumentDialog({ open, onOpenChange, fixedProjectId, fixedTeamId }: { open: boolean; onOpenChange: (open: boolean) => void; fixedProjectId?: string; fixedTeamId?: string }) {
  const { data: projects = [] } = useProjects();
  const { data: teams = [] } = useTeams();
  const actor = useAuthStore(state => state.user);
  const canWorkspace = actor?.role === 'owner' || actor?.role === 'admin';
  const initialScope = fixedProjectId ? `project:${fixedProjectId}` : fixedTeamId ? `team:${fixedTeamId}` : canWorkspace ? 'workspace' : '';
  const [scope, setScope] = React.useState(initialScope);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const create = useCreateDocument();
  React.useEffect(() => { if (open) { setScope(initialScope); setTitle(''); setContent(''); } }, [open, initialScope]);
  const fixed = Boolean(fixedProjectId || fixedTeamId);
  const scopeItems = [
    ...(canWorkspace ? [{ value: 'workspace', label: 'Workspace document' }] : []),
    ...teams.map(team => ({ value: `team:${team.id}`, label: `Team · ${team.name}` })),
    ...projects.map(project => ({ value: `project:${project.id}`, label: `Project · ${project.name}` })),
  ];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!scope || !title.trim()) return;
    const [kind, id] = scope.split(':');
    try {
      await create.mutateAsync({ title: title.trim(), content, ...(kind === 'team' ? { teamId: id } : {}), ...(kind === 'project' ? { projectId: id } : {}) });
      onOpenChange(false);
    } catch { /* hook reports the server error */ }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><form onSubmit={submit} className="flex flex-col gap-4">
    <DialogHeader><DialogTitle>New document</DialogTitle><DialogDescription>Save internal knowledge in the scope where its readers already have access.</DialogDescription></DialogHeader>
    {fixed ? <p className="text-xs text-muted-foreground">{fixedProjectId ? 'Project document' : 'Team document'}</p> : <Select value={scope} onValueChange={setScope}><SelectTrigger aria-label="Document scope"><SelectValue placeholder="Choose a scope" /></SelectTrigger><SelectContent>{scopeItems.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>}
    <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Document title" maxLength={180} required aria-label="Document title" />
    <Textarea value={content} onChange={event => setContent(event.target.value)} placeholder="Write notes in Markdown…" maxLength={50000} rows={8} aria-label="Document content" />
    {create.isError && <Alert variant="destructive"><AlertDescription>{create.error.message}</AlertDescription></Alert>}
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!scope || !title.trim() || create.isPending}>{create.isPending ? 'Creating…' : 'Create document'}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
